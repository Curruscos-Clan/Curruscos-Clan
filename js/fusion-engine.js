(function () {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const client = () => window.supabaseClient;
  const status = $('#fusion-status');
  const stage = $('#fusion-stage');
  const radar = $('#fusion-radar');
  const proposalMount = $('#fusion-proposal');
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  let activeSparkId = null;
  let selectedEnergy = 'competitiva';

  function say(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }
  function drawRadar(count = 1, required = 4) {
    radar.replaceChildren();
    const wrap = el('div', 'fusion-radar');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', count + ' de ' + required + ' personas han aceptado');
    wrap.append(el('span', 'fusion-wave fusion-wave-one'), el('span', 'fusion-wave fusion-wave-two'));
    const core = el('div', 'fusion-core');
    core.append(el('strong', '', count + '/' + required), el('small', '', 'SINTONÍA'));
    wrap.append(core);
    radar.append(wrap, el('p', 'fusion-muted', count >= required
      ? '¡Masa crítica alcanzada! Se está confirmando el plan.'
      : 'La propuesta solo se convierte en evento cuando suficientes personas aceptan.'));
    stage.hidden = false;
  }
  function drawProposal(proposal) {
    proposalMount.replaceChildren();
    const card = el('article', 'fusion-proposal-card');
    card.append(el('span', 'fusion-live', '⚡ PROPUESTA ESPONTÁNEA'), el('h2', '', proposal.suggested_title));
    const start = new Date(proposal.proposed_start);
    card.append(
      el('p', 'fusion-muted', start.toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' · Zona ' + proposal.geo_zone),
      el('p', '', proposal.proposed_location),
      el('p', 'fusion-muted', 'El plan solo se crea cuando al menos ' + proposal.quorum_required + ' personas aceptan.')
    );
    const actions = el('div', 'fusion-actions');
    const accept = el('button', 'fusion-primary', 'Me apunto');
    const pass = el('button', 'fusion-secondary', 'Paso');
    accept.type = pass.type = 'button';
    actions.append(accept, pass); card.append(actions); proposalMount.append(card);

    accept.addEventListener('click', async () => {
      accept.disabled = pass.disabled = true;
      say('Registrando tu respuesta…');
      try {
        const { data, error } = await client().rpc('respond_fusion_proposal', {
          target_proposal_id: proposal.id, accept: true
        });
        if (error) throw error;
        if (data.confirmed && data.event_id) {
          say('¡Plan creado! Abriendo la quedada…');
          location.href = 'evento-publico.html?id=' + encodeURIComponent(data.event_id);
          return;
        }
        drawRadar(data.accepted_count || 1, data.required || proposal.quorum_required);
        say('Has aceptado (' + (data.accepted_count || 1) + '/' + (data.required || proposal.quorum_required) + '). Esperando más confirmaciones.');
        accept.textContent = 'Ya estás dentro'; accept.disabled = true; pass.disabled = true;
      } catch (error) {
        say(error.message || 'No se ha podido guardar la respuesta.', true);
        accept.disabled = pass.disabled = false;
      }
    });
    pass.addEventListener('click', async () => {
      accept.disabled = pass.disabled = true;
      try {
        const { error } = await client().rpc('respond_fusion_proposal', {
          target_proposal_id: proposal.id, accept: false
        });
        if (error) throw error;
        proposalMount.replaceChildren();
        say('Has pasado de esta propuesta. El resto de personas puede seguir confirmando.');
      } catch (error) {
        say(error.message || 'No se ha podido descartar la propuesta.', true);
        accept.disabled = pass.disabled = false;
      }
    });
  }
  async function loadProposal(proposalId) {
    const { data, error } = await client().from('fusion_proposals')
      .select('id,suggested_title,proposed_start,proposed_end,proposed_location,geo_zone,quorum_required,accepted_user_ids,status,expires_at')
      .eq('id', proposalId).maybeSingle();
    if (error) throw error;
    if (!data || data.status !== 'pending') throw new Error('La propuesta ya no está disponible.');
    drawProposal(data);
    drawRadar((data.accepted_user_ids || []).length, data.quorum_required);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const now = new Date(Date.now() + 10 * 60 * 1000);
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const localInputValue = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    $('#fusion-start').value = localInputValue(now);
    $('#fusion-end').value = localInputValue(end);

    document.querySelectorAll('[data-energy]').forEach(button => {
      button.addEventListener('click', () => {
        selectedEnergy = button.dataset.energy;
        document.querySelectorAll('[data-energy]').forEach(item => {
          const active = item === button;
          item.classList.toggle('active', active);
          item.setAttribute('aria-pressed', String(active));
        });
      });
    });

    const form = $('#fusion-form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = $('#fusion-submit');
      submit.disabled = true; submit.textContent = 'Buscando sintonía…'; status.classList.remove('is-error');
      try {
        const supabase = client();
        if (!supabase) throw new Error('No se ha podido iniciar la conexión. Recarga la página.');
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth?.user) throw new Error('Inicia sesión para lanzar una chispa.');
        const start = new Date($('#fusion-start').value);
        const endDate = new Date($('#fusion-end').value);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(endDate.getTime()) ||
            start < new Date() || endDate <= start || endDate - start > 24 * 60 * 60 * 1000) {
          throw new Error('Elige una franja futura de hasta 24 horas.');
        }
        const zone = $('#fusion-zone').value.trim();
        if (!zone) throw new Error('Elige una zona aproximada.');
        const resources = {
          coche: $('#resource-car').checked,
          material: $('#resource-kit').checked,
          pista: $('#resource-court').checked
        };
        // Free the one-live-spark slot if an older spark has expired.
        await supabase.from('sparks').update({ status: 'expirada' })
          .in('status', ['viva', 'resonando'])
          .lte('expires_at', new Date().toISOString()).eq('user_id', auth.user.id);

        const { data: spark, error: insertError } = await supabase.from('sparks').insert({
          user_id: auth.user.id,
          energy_type: selectedEnergy,
          category: $('#fusion-category').value,
          time_window_start: start.toISOString(),
          time_window_end: endDate.toISOString(),
          geo_zone: zone,
          resources_offered: resources,
          expires_at: endDate.toISOString()
        }).select('id').single();
        if (insertError) throw insertError;
        activeSparkId = spark.id;
        const { data: result, error: evalError } = await supabase.rpc('evaluate_spark_resonance', { new_spark_id: spark.id });
        if (evalError) throw evalError;
        form.hidden = true; stage.hidden = false;
        if (result?.proposal_id) {
          await loadProposal(result.proposal_id);
          say('¡Hay sintonía! Revisa la propuesta y confirma si te encaja.');
        } else {
          drawRadar(result?.participants_count || result?.active_in_zone || 1, result?.required || 4);
          say('Chispa encendida. Aún no hay suficientes personas compatibles; no se garantiza una coincidencia.');
        }
      } catch (error) {
        say(error.message || 'No se ha podido lanzar la chispa.', true);
      } finally {
        submit.disabled = false; submit.textContent = 'Encender mi chispa ⚡';
      }
    });

    const cancel = $('#fusion-cancel');
    cancel.addEventListener('click', async () => {
      cancel.disabled = true;
      try {
        if (activeSparkId && client()) {
          const { error } = await client().from('sparks').update({ status: 'expirada' }).eq('id', activeSparkId);
          if (error) throw error;
        }
        activeSparkId = null; form.reset(); form.hidden = false; stage.hidden = true;
        proposalMount.replaceChildren(); radar.replaceChildren();
        say('Chispa cerrada. Ya puedes lanzar otra intención.');
      } catch (error) {
        say(error.message || 'No se ha podido cerrar la chispa.', true);
      } finally { cancel.disabled = false; }
    });
  });
})();