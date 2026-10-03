document.addEventListener("DOMContentLoaded", async () => {
    await window.curruscosI18n?.ready;
    const access = await window.curruscosReady;

    if (!access) {
        return;
    }

    const list = document.getElementById("pollsList");
    const form = document.getElementById("pollForm");
    const builder = document.getElementById("optionBuilder");
    const addOptionButton = document.getElementById("addOptionButton");
    const focusCreateButton = document.getElementById("focusCreateButton");
    const createPanel = document.getElementById("createPanel");
    const errorEl = document.getElementById("formError");

    let optionCount = 0;

    function addOption(value = "") {
        if (builder.children.length >= 6) {
            return;
        }

        optionCount += 1;

        const row = document.createElement("div");
        row.className = "option-row-input";

        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 120;
        input.placeholder = "Opción " + optionCount;
        input.value = value;
        input.required = true;

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove-option";
        remove.textContent = "×";
        remove.setAttribute("aria-label", "Eliminar opción");

        remove.addEventListener("click", () => {
            if (builder.children.length <= 2) {
                return;
            }
            row.remove();
            refreshOptionLabels();
        });

        row.append(input, remove);
        builder.appendChild(row);
        refreshOptionLabels();
    }

    function refreshOptionLabels() {
        [...builder.querySelectorAll("input")].forEach((input, index) => {
            input.placeholder = "Opción " + (index + 1);
        });

        [...builder.querySelectorAll(".remove-option")].forEach(button => {
            button.disabled = builder.children.length <= 2;
        });

        addOptionButton.disabled = builder.children.length >= 6;
    }

    addOption();
    addOption();

    addOptionButton.addEventListener("click", () => addOption());

    focusCreateButton.addEventListener("click", () => {
        createPanel.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => document.getElementById("pollQuestion")?.focus(), 350);
    });

    function formatPollDate(value) {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleDateString(getLanguage(), {
            day: "numeric",
            month: "short"
        });
    }

    async function renderPolls() {
        list.innerHTML = '<div class="empty-polls">Cargando decisiones…</div>';

        const polls = await getGroupPolls();
        const pollIds = polls.map(poll => poll.id);

        const [myVotes, ...results] = await Promise.all([
            getMyPollVotes(pollIds),
            ...pollIds.map(pollId => getPollResults(pollId))
        ]);

        const myVoteMap = new Map(
            myVotes.map(vote => [String(vote.poll_id), String(vote.option_id)])
        );

        const resultMap = new Map(
            pollIds.map((pollId, index) => [pollId, results[index] || []])
        );

        polls.sort((a, b) => {
            if (Boolean(a.is_closed) !== Boolean(b.is_closed)) {
                return a.is_closed ? 1 : -1;
            }
            return new Date(b.created_at) - new Date(a.created_at);
        });

        list.innerHTML = "";

        if (!polls.length) {
            list.innerHTML =
                '<div class="empty-polls">Todavía no hay decisiones. Cread la primera cuando tengáis algo que resolver.</div>';
            return;
        }

        polls.forEach(poll => {
            const votes = resultMap.get(poll.id) || [];
            const selectedOption = myVoteMap.get(String(poll.id));
            const totalVotes = votes.length;

            const card = document.createElement("article");
            card.className = "poll-card" + (poll.is_closed ? " closed" : "");

            const head = document.createElement("div");
            head.className = "poll-head";

            const titleWrap = document.createElement("div");
            titleWrap.innerHTML =
                '<span class="poll-kicker">DECISIÓN · ' +
                escapeHtml(formatPollDate(poll.created_at)) +
                '</span>' +
                '<h3 class="poll-question">' +
                escapeHtml(poll.question || "Decisión") +
                '</h3>' +
                (poll.description
                    ? '<p class="poll-description">' + escapeHtml(poll.description) + '</p>'
                    : "");

            const status = document.createElement("span");
            status.className = "poll-status" + (poll.is_closed ? "" : " open");
            status.textContent = poll.is_closed ? "CERRADA" : "ABIERTA";

            head.append(titleWrap, status);

            const options = document.createElement("div");
            options.className = "poll-options";

            const optionData = poll.poll_options || [];
            const counts = new Map();

            optionData.forEach(option => {
                counts.set(
                    String(option.id),
                    votes.filter(vote => String(vote.option_id) === String(option.id)).length
                );
            });

            const maxVotes = Math.max(1, ...counts.values());

            optionData.forEach(option => {
                const optionId = String(option.id);
                const count = counts.get(optionId) || 0;
                const percent = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                const selected = selectedOption === optionId;

                const optionCard = document.createElement("div");
                optionCard.className = "poll-option" + (selected ? " selected" : "");

                const bar = document.createElement("span");
                bar.className = "poll-option-bar";
                bar.style.width = (count ? Math.max(5, (count / maxVotes) * 100) : 0) + "%";

                const button = document.createElement("button");
                button.type = "button";
                button.className = "poll-option-button";
                button.disabled = Boolean(poll.is_closed || selectedOption);
                button.innerHTML =
                    '<span class="poll-option-row">' +
                        '<span class="poll-option-name">' + escapeHtml(option.option_text) + '</span>' +
                        '<span class="poll-option-meta">' +
                            count + " " + (count === 1 ? "voto" : "votos") +
                            (totalVotes ? " · " + percent + "%" : "") +
                        '</span>' +
                    '</span>';

                button.addEventListener("click", async () => {
                    if (poll.is_closed || selectedOption) {
                        return;
                    }

                    button.disabled = true;

                    const saved = await voteInPoll(poll.id, option.id);

                    if (!saved) {
                        button.disabled = false;
                        alert("No se ha podido registrar el voto.");
                        return;
                    }

                    await renderPolls();
                });

                optionCard.append(bar, button);
                options.appendChild(optionCard);
            });

            const actions = document.createElement("div");
            actions.className = "poll-vote-actions";

            const note = document.createElement("span");
            note.className = "poll-vote-note";

            if (poll.is_closed) {
                note.textContent = totalVotes
                    ? totalVotes + " " + (totalVotes === 1 ? "voto registrado." : "votos registrados.")
                    : "Todavía no hay votos.";
            } else if (selectedOption) {
                note.textContent = "Ya has votado. La decisión sigue abierta.";
            } else {
                note.textContent = "Elige una opción para votar.";
            }

            actions.appendChild(note);

            const canClose =
                !poll.is_closed &&
                (
                    access.currentGroup.role === "owner" ||
                    access.currentGroup.role === "admin" ||
                    poll.created_by === access.user.id
                );

            if (canClose) {
                const close = document.createElement("button");
                close.type = "button";
                close.className = "poll-close";
                close.textContent = "Cerrar votación";

                close.addEventListener("click", async () => {
                    if (!confirm("¿Cerrar esta votación? Los votos seguirán visibles.")) {
                        return;
                    }

                    close.disabled = true;

                    const updated = await closePoll(poll.id);

                    if (!updated) {
                        close.disabled = false;
                        alert("No se ha podido cerrar la votación.");
                        return;
                    }

                    await renderPolls();
                });

                actions.appendChild(close);
            }

            card.append(head, options, actions);
            list.appendChild(card);
        });
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        errorEl.textContent = "";

        const question = document.getElementById("pollQuestion").value.trim();
        const description = document.getElementById("pollDescription").value.trim();
        const options = [...builder.querySelectorAll("input")]
            .map(input => input.value.trim())
            .filter(Boolean);

        const uniqueOptions = [...new Set(options.map(option => option.toLocaleLowerCase()))];

        if (options.length < 2) {
            errorEl.textContent = "Necesitas al menos dos opciones.";
            return;
        }

        if (uniqueOptions.length !== options.length) {
            errorEl.textContent = "No repitas opciones.";
            return;
        }

        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        submit.textContent = "Creando…";

        const created = await createGroupPoll(question, description, options);

        if (!created) {
            errorEl.textContent = "No se ha podido crear la votación. Revisa la conexión e inténtalo de nuevo.";
            submit.disabled = false;
            submit.textContent = "Crear votación";
            return;
        }

        form.reset();
        builder.innerHTML = "";
        optionCount = 0;
        addOption();
        addOption();

        submit.disabled = false;
        submit.textContent = "Crear votación";

        await renderPolls();
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    await renderPolls();
});