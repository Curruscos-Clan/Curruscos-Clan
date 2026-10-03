/* =========================================================
   CURRUSCOS — DETALLE DE EVENTO
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    await window.curruscosI18n?.ready;
    const access = await window.curruscosReady;

    if (!access) {
        return;
    }

    let currentEvent = null;
    const currentUser =
        access.user;
    const currentGroup =
        access.currentGroup;

    let members = [];
    let participants = [];
    let tasks = [];
    let expenses = [];
    let expenseSplits = new Map();
    let relatedTrip = null;
    let taskFilter = "all";

    const params =
        new URLSearchParams(
            window.location.search
        );

    const eventId =
        params.get("id");

    const eventChatButton =
        document.getElementById("eventChatButton");

    if (eventChatButton && eventId) {
        eventChatButton.href =
            "chat.html?event=" + encodeURIComponent(eventId);
    }

    if (!eventId) {
        document.getElementById(
            "eventTitle"
        ).textContent =
            "Evento no encontrado";
        return;
    }

    function canManageGroup() {
        return (
            currentGroup.role === "owner" ||
            currentGroup.role === "admin"
        );
    }

    function canManageEvent() {
        return Boolean(
            currentEvent &&
            (
                canManageGroup() ||
                currentEvent.created_by ===
                    currentUser.id
            )
        );
    }

    function memberName(userId) {
        const member =
            members.find(
                item =>
                    String(item.user_id) ===
                    String(userId)
            );

        return (
            member?.display_name ||
            member?.username ||
            "Miembro"
        );
    }

    function statusLabel(status) {
        switch (status) {
            case "yes":
                return "Va";
            case "no":
                return "No va";
            default:
                return "Pendiente";
        }
    }

    function statusClass(status) {
        if (status === "yes") {
            return "status-yes";
        }

        if (status === "no") {
            return "status-no";
        }

        return "status-pending";
    }

    function renderMyAttendance() {
        const container = document.getElementById("myAttendancePanel");
        if (!container) return;

        const currentParticipant = participants.find(
            item => String(item.user_id) === String(currentUser.id)
        );
        const status = currentParticipant?.status || "pending";

        const labels = {
            yes: "Has confirmado que vas.",
            no: "Has indicado que no vas.",
            pending: "Todavía no has respondido."
        };

        container.innerHTML = "";

        const copy = document.createElement("div");
        copy.className = "my-attendance-copy";

        const title = document.createElement("strong");
        title.textContent = "Tu asistencia";

        const description = document.createElement("span");
        description.textContent = labels[status] || labels.pending;

        copy.append(title, description);

        const actions = document.createElement("div");
        actions.className = "my-attendance-actions";

        [
            ["yes", "✓ Voy"],
            ["no", "No voy"],
            ["pending", "Pendiente"]
        ].forEach(([value, label]) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "my-attendance-choice";
            button.textContent = label;
            button.classList.toggle("active", status === value);
            button.setAttribute("aria-pressed", String(status === value));

            if (status === value) {
                button.disabled = true;
            }

            button.addEventListener("click", async () => {
                actions.querySelectorAll("button").forEach(item => item.disabled = true);

                const updated = await setEventParticipant(
                    currentEvent.id,
                    currentUser.id,
                    value
                );

                if (!updated) {
                    actions.querySelectorAll("button").forEach(item => item.disabled = false);
                    alert("No se ha podido actualizar tu asistencia.");
                    return;
                }

                participants = participants.filter(
                    item => String(item.user_id) !== String(currentUser.id)
                );
                participants.push(updated);

                renderMyAttendance();
                renderParticipants();
                updateProgress();
                updateStatus();
                updateCommandCenter();
            });

            actions.appendChild(button);
        });

        container.append(copy, actions);
    }

    function renderParticipants() {
        const container = document.getElementById("participantsList");
        container.innerHTML = "";

        let yes = 0;
        let no = 0;
        let pending = 0;

        const orderedMembers = [...members].sort((a, b) => {
            const rank = status => status === "pending" ? 0 : status === "yes" ? 1 : 2;
            const sa = participants.find(item => String(item.user_id) === String(a.user_id))?.status || "pending";
            const sb = participants.find(item => String(item.user_id) === String(b.user_id))?.status || "pending";
            return rank(sa) - rank(sb);
        });

        orderedMembers.forEach(member => {
            const participant = participants.find(
                item => String(item.user_id) === String(member.user_id)
            );
            const status = participant?.status || "pending";

            if (status === "yes") yes++;
            else if (status === "no") no++;
            else pending++;

            const row = document.createElement("div");
            row.className = "participant-card";

            const info = document.createElement("div");
            info.className = "participant-main";

            const avatar = document.createElement("div");
            avatar.className = "participant-avatar";
            avatar.textContent = memberName(member.user_id).charAt(0).toUpperCase();

            const copy = document.createElement("div");
            copy.className = "participant-information";

            const strong = document.createElement("strong");
            strong.className = "participant-name";
            strong.textContent = memberName(member.user_id);

            const badge = document.createElement("span");
            badge.className = "participant-status-text";
            badge.textContent = statusLabel(status);

            copy.append(strong, badge);
            info.append(avatar, copy);

            const actions = document.createElement("div");
            actions.className = "participant-actions";

            [["yes", "Voy"], ["pending", "Pendiente"], ["no", "No voy"]].forEach(([value, label]) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "participant-choice";
                button.textContent = label;
                button.title = "Marcar: " + label;
                button.setAttribute("aria-pressed", String(status === value));

                if (status === value) button.classList.add("active");

                const canEdit =
                    canManageGroup() ||
                    String(member.user_id) === String(currentUser.id);

                button.disabled = !canEdit;

                if (canEdit && status !== value) {
                    button.addEventListener("click", async () => {
                        actions.querySelectorAll("button").forEach(item => item.disabled = true);

                        const updated = await setEventParticipant(
                            currentEvent.id,
                            member.user_id,
                            value
                        );

                        if (!updated) {
                            actions.querySelectorAll("button").forEach(item => item.disabled = false);
                            alert("No se ha podido actualizar la participación.");
                            return;
                        }

                        participants = participants.filter(
                            item => String(item.user_id) !== String(member.user_id)
                        );
                        participants.push(updated);

                        renderParticipants();
                        updateProgress();
                        updateStatus();
                    });
                }

                actions.appendChild(button);
            });

            row.append(info, actions);
            container.appendChild(row);
        });

        document.getElementById("participantsYes").textContent = String(yes);
        document.getElementById("participantsPending").textContent = String(pending);
        document.getElementById("participantsNo").textContent = String(no);

        if (!members.length) {
            container.innerHTML =
                '<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-title">No hay miembros en este grupo</div><div class="empty-state-text">Añade personas al workspace para poder invitarlas al evento.</div></div>';
        }
    }

    function renderTaskAssignees() {
        const select =
            document.getElementById(
                "taskAssignee"
            );

        select.innerHTML =
            '<option value="">Sin responsable</option>';

        members.forEach(member => {
            const option =
                document.createElement("option");

            option.value =
                member.user_id;

            option.textContent =
                memberName(
                    member.user_id
                );

            select.appendChild(
                option
            );
        });
    }

    function renderTasks() {
        const container = document.getElementById("tasksList");
        container.innerHTML = "";

        const titleEl = document.getElementById("taskListTitle");
        const metaEl = document.getElementById("taskListMeta");
        const filters = document.querySelectorAll("[data-task-filter]");

        const filtered = tasks.filter(task => {
            if (taskFilter === "mine") {
                return String(task.assigned_to || "") === String(currentUser.id);
            }
            if (taskFilter === "pending") {
                return !task.completed;
            }
            if (taskFilter === "done") {
                return Boolean(task.completed);
            }
            return true;
        });

        const pendingCount = tasks.filter(task => !task.completed).length;
        const mineCount = tasks.filter(task =>
            String(task.assigned_to || "") === String(currentUser.id) && !task.completed
        ).length;

        if (titleEl) {
            titleEl.textContent = taskFilter === "mine"
                ? "Tus tareas"
                : taskFilter === "pending"
                    ? "Pendientes"
                    : taskFilter === "done"
                        ? "Completadas"
                        : "Preparación";
        }

        if (metaEl) {
            metaEl.textContent = tasks.length
                ? tasks.length + (tasks.length === 1 ? " tarea" : " tareas") +
                    " · " + pendingCount + " pendientes" +
                    (mineCount ? " · " + mineCount + " para ti" : "")
                : "Organizad lo que queda por hacer.";
        }

        filters.forEach(button => {
            const active = button.dataset.taskFilter === taskFilter;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });

        if (!tasks.length) {
            container.innerHTML =
                '<div class="task-empty">Todavía no hay tareas. Crea la primera para repartir la preparación.</div>';
            return;
        }

        if (!filtered.length) {
            const emptyText = taskFilter === "mine"
                ? "No tienes tareas asignadas ahora mismo."
                : taskFilter === "pending"
                    ? "No quedan tareas pendientes."
                    : "Todavía no hay tareas completadas.";
            container.innerHTML =
                '<div class="task-empty">' + emptyText + '</div>';
            return;
        }

        const ordered = [...filtered].sort((a, b) =>
            Number(Boolean(a.completed)) - Number(Boolean(b.completed))
        );

        ordered.forEach(task => {
            const card = document.createElement("article");
            card.className = "task-card";
            if (task.completed) card.classList.add("completed");

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = Boolean(task.completed);

            const canComplete =
                canManageGroup() ||
                task.created_by === currentUser.id ||
                task.assigned_to === currentUser.id;

            checkbox.disabled = !canComplete;
            checkbox.setAttribute(
                "aria-label",
                (task.completed ? "Reabrir " : "Completar ") + (task.title || "tarea")
            );

            checkbox.addEventListener("change", async () => {
                const next = checkbox.checked;
                checkbox.disabled = true;
                const updated = await updateEventTask(task.id, next);

                if (!updated) {
                    checkbox.checked = !next;
                    checkbox.disabled = !canComplete;
                    alert("No se ha podido actualizar la tarea.");
                    return;
                }

                Object.assign(task, updated);
                renderTasks();
                updateProgress();
                updateStatus();
                updateCommandCenter();
            });

            const copy = document.createElement("div");
            copy.className = "task-copy";

            const title = document.createElement("strong");
            title.textContent = task.title || "Tarea";

            const assignee = document.createElement("span");
            assignee.textContent = task.assigned_to
                ? "Responsable: " + memberName(task.assigned_to)
                : "Sin responsable";

            const state = document.createElement("small");
            state.className = "task-state";
            state.textContent = task.completed
                ? "Completada"
                : String(task.assigned_to || "") === String(currentUser.id)
                    ? "Te corresponde"
                    : "Pendiente";

            copy.append(title, assignee, state);

            const right = document.createElement("div");
            right.className = "task-actions";

            const canEditDetails =
                canManageGroup() ||
                task.created_by === currentUser.id;

            if (canEditDetails) {
                const edit = document.createElement("button");
                edit.type = "button";
                edit.className = "task-edit-button";
                edit.textContent = "Editar";
                edit.addEventListener("click", () => {
                    const editor = document.createElement("div");
                    editor.className = "task-edit-form";

                    const titleInput = document.createElement("input");
                    titleInput.type = "text";
                    titleInput.maxLength = 100;
                    titleInput.value = task.title || "";
                    titleInput.setAttribute("aria-label", "Título de la tarea");

                    const assigneeSelect = document.createElement("select");
                    assigneeSelect.setAttribute("aria-label", "Responsable de la tarea");

                    const none = document.createElement("option");
                    none.value = "";
                    none.textContent = "Sin responsable";
                    assigneeSelect.appendChild(none);

                    members.forEach(member => {
                        const option = document.createElement("option");
                        option.value = member.user_id;
                        option.textContent = memberName(member.user_id);
                        assigneeSelect.appendChild(option);
                    });

                    assigneeSelect.value = task.assigned_to || "";

                    const controls = document.createElement("div");
                    controls.className = "task-edit-controls";

                    const save = document.createElement("button");
                    save.type = "button";
                    save.className = "task-edit-save";
                    save.textContent = "Guardar";

                    const cancel = document.createElement("button");
                    cancel.type = "button";
                    cancel.className = "task-edit-cancel";
                    cancel.textContent = "Cancelar";

                    controls.append(save, cancel);
                    editor.append(titleInput, assigneeSelect, controls);
                    copy.replaceChildren(editor);

                    titleInput.focus();
                    titleInput.select();

                    cancel.addEventListener("click", () => renderTasks());

                    save.addEventListener("click", async () => {
                        const nextTitle = titleInput.value.trim();
                        if (!nextTitle) {
                            titleInput.focus();
                            return;
                        }

                        save.disabled = true;
                        cancel.disabled = true;
                        save.textContent = "Guardando…";

                        const updated = await updateEventTask(
                            task.id,
                            task.completed,
                            {
                                title: nextTitle,
                                assigned_to: assigneeSelect.value || null
                            }
                        );

                        if (!updated) {
                            save.disabled = false;
                            cancel.disabled = false;
                            save.textContent = "Guardar";
                            alert("No se ha podido editar la tarea.");
                            return;
                        }

                        Object.assign(task, updated);
                        renderTasks();
                        updateProgress();
                        updateStatus();
                        updateCommandCenter();
                    });
                });

                right.appendChild(edit);

                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "task-remove-button";
                remove.textContent = "Eliminar";
                remove.addEventListener("click", async () => {
                    if (!confirm("¿Eliminar esta tarea?")) return;

                    remove.disabled = true;
                    const deleted = await deleteEventTask(task.id);

                    if (!deleted) {
                        remove.disabled = false;
                        alert("No se ha podido eliminar la tarea.");
                        return;
                    }

                    tasks = tasks.filter(item => String(item.id) !== String(task.id));
                    renderTasks();
                    updateProgress();
                    updateStatus();
                    updateCommandCenter();
                });
                right.appendChild(remove);
            }

            card.append(checkbox, copy, right);
            container.appendChild(card);
        });
    }

    function formatMoney(value) {
        return Number(value || 0)
            .toLocaleString(
                "es-ES",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            ) + " €";
    }

    function renderExpenses() {
        const container =
            document.getElementById(
                "expensesList"
            );

        const total =
            expenses.reduce(
                (sum, expense) =>
                    sum +
                    (
                        Number(
                            expense.amount
                        ) || 0
                    ),
                0
            );

        document.getElementById(
            "expensesTotal"
        ).textContent =
            formatMoney(total);

        document.getElementById(
            "expensesCount"
        ).textContent =
            String(expenses.length);

        container.innerHTML = "";

        if (!expenses.length) {
            container.innerHTML =
                '<div class="expense-empty">Todavía no hay gastos en este evento.</div>';
            renderExpenseSplit();
            return;
        }

        expenses.forEach(expense => {
            const card = document.createElement("article");
            card.className = "expense-card";

            const info = document.createElement("div");
            info.className = "expense-info";

            const title = document.createElement("strong");
            title.textContent = expense.title || "Gasto";

            const meta = document.createElement("span");
            meta.textContent = "Pagado por " + memberName(expense.paid_by);

            const saved = expenseSplits.get(String(expense.id)) || [];
            const going = getGoingMembers();
            const isCustom = saved.length > 0;
            const splitHint = document.createElement("small");
            splitHint.className = "expense-split-status";
            splitHint.textContent = isCustom
                ? "✓ Reparto personalizado"
                : going.length
                    ? "Reparto igual entre quienes van"
                    : "Pendiente de asistencia";

            info.append(title, meta, splitHint);

            const right = document.createElement("div");
            right.className = "expense-card-right";

            const amount = document.createElement("strong");
            amount.className = "expense-card-amount";
            amount.textContent = formatMoney(expense.amount);
            right.appendChild(amount);

            if (canManageGroup() || expense.created_by === currentUser.id) {
                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "expense-remove-button";
                remove.textContent = "Eliminar";
                remove.addEventListener("click", async () => {
                    if (!confirm("¿Eliminar este gasto?")) return;

                    remove.disabled = true;
                    const deleted = await deleteEventExpense(expense.id);

                    if (!deleted) {
                        remove.disabled = false;
                        alert("No se ha podido eliminar el gasto.");
                        return;
                    }

                    expenses = expenses.filter(item => String(item.id) !== String(expense.id));
                    expenseSplits.delete(String(expense.id));
                    renderExpenses();
                    updateProgress();
                    updateStatus();
                });
                right.appendChild(remove);
            }

            card.append(info, right);
            container.appendChild(card);
        });

        renderExpenseSplit();
    }

    function getGoingMembers() {
        return members.filter(member => {
            const participant = participants.find(
                item => String(item.user_id) === String(member.user_id)
            );
            return participant?.status === "yes";
        });
    }

    function balancesForDisplay(expenseList, goingMembers) {
        const balances = new Map();

        goingMembers.forEach(member => balances.set(String(member.user_id), 0));

        expenseList.forEach(expense => {
            const payer = String(expense.paid_by || "");
            const savedSplits = expenseSplits.get(String(expense.id)) || [];
            const splits = savedSplits.length
                ? savedSplits
                : goingMembers.map(member => ({
                    user_id: member.user_id,
                    amount: Number(expense.amount || 0) / goingMembers.length
                }));

            if (balances.has(payer)) {
                balances.set(payer, balances.get(payer) + Number(expense.amount || 0));
            }

            splits.forEach(split => {
                const userId = String(split.user_id);
                if (balances.has(userId)) {
                    balances.set(userId, balances.get(userId) - Number(split.amount || 0));
                }
            });
        });

        return balances;
    }

    function calculateBalances() {
        const going = getGoingMembers();
        const balances = new Map();

        going.forEach(member => balances.set(String(member.user_id), 0));

        expenses.forEach(expense => {
            const payer = String(expense.paid_by || "");
            const savedSplits = expenseSplits.get(String(expense.id)) || [];
            const splits = savedSplits.length
                ? savedSplits
                : going.map(member => ({
                    user_id: member.user_id,
                    amount: Number(expense.amount || 0) / going.length
                }));

            if (balances.has(payer)) {
                balances.set(
                    payer,
                    balances.get(payer) + Number(expense.amount || 0)
                );
            }

            splits.forEach(split => {
                const userId = String(split.user_id);
                if (balances.has(userId)) {
                    balances.set(
                        userId,
                        balances.get(userId) - Number(split.amount || 0)
                    );
                }
            });
        });

        return balances;
    }

    function buildSettlementTransfers() {
        const balances = calculateBalances();
        const creditors = [];
        const debtors = [];

        balances.forEach((balance, userId) => {
            if (balance > 0.01) creditors.push({ userId, amount: balance });
            if (balance < -0.01) debtors.push({ userId, amount: -balance });
        });

        creditors.sort((a, b) => b.amount - a.amount);
        debtors.sort((a, b) => b.amount - a.amount);

        const transfers = [];
        let i = 0;
        let j = 0;

        while (i < debtors.length && j < creditors.length) {
            const amount = Math.min(debtors[i].amount, creditors[j].amount);
            transfers.push({
                from: debtors[i].userId,
                to: creditors[j].userId,
                amount
            });

            debtors[i].amount -= amount;
            creditors[j].amount -= amount;

            if (debtors[i].amount <= 0.01) i++;
            if (creditors[j].amount <= 0.01) j++;
        }

        return transfers;
    }

    function renderExpenseSplit() {
        const container = document.getElementById("expenseSplit");
        container.innerHTML = "";

        if (!expenses.length) return;

        const going = getGoingMembers();
        if (!going.length) {
            container.textContent = "Confirma quién va al evento para calcular el reparto.";
            return;
        }

        const total = expenses.reduce(
            (sum, expense) => sum + Number(expense.amount || 0), 0
        );

        const hasSavedSplits = expenses.some(
            expense => (expenseSplits.get(String(expense.id)) || []).length
        );

        const currentUserBalance =
            balancesForDisplay(expenses, going).get(String(currentUser.id)) || 0;

        const heading = document.createElement("div");
        heading.className = "expense-split-title";
        heading.textContent = "💸 Reparto y deudas";

        const note = document.createElement("p");
        note.className = "expense-split-note";
        note.textContent = hasSavedSplits
            ? "El reparto usa los importes guardados para cada gasto."
            : "Por defecto, cada gasto se reparte a partes iguales entre quienes van.";

        container.append(heading, note);

        const transfers = buildSettlementTransfers();

        const balances = calculateBalances();
        if (Math.abs(currentUserBalance) > 0.01) {
            const own = document.createElement("div");
            own.className = "expense-own-balance " +
                (currentUserBalance > 0 ? "expense-balance-positive" : "expense-balance-negative");
            own.textContent = currentUserBalance > 0
                ? "Tu saldo: te deben " + formatMoney(currentUserBalance)
                : "Tu saldo: debes " + formatMoney(Math.abs(currentUserBalance));
            container.appendChild(own);
        } else if (going.some(member => String(member.user_id) === String(currentUser.id))) {
            const own = document.createElement("div");
            own.className = "expense-own-balance expense-balance-zero";
            own.textContent = "Tu saldo está equilibrado.";
            container.appendChild(own);
        }

        const balanceTitle = document.createElement("div");
        balanceTitle.className = "expense-settlement-title";
        balanceTitle.textContent = "Balance por persona";
        container.appendChild(balanceTitle);

        going.forEach(member => {
            const row = document.createElement("div");
            row.className = "expense-person-row";
            const name = document.createElement("span");
            name.textContent = memberName(member.user_id);
            const result = document.createElement("strong");
            const balance = balances.get(String(member.user_id)) || 0;
            result.textContent = balance > 0.01
                ? "A favor " + formatMoney(balance)
                : balance < -0.01
                    ? "Debe " + formatMoney(Math.abs(balance))
                    : "Equilibrado";
            result.className = balance > 0.01
                ? "expense-balance-positive"
                : balance < -0.01
                    ? "expense-balance-negative"
                    : "expense-balance-neutral";
            row.append(name, result);
            container.appendChild(row);
        });

        if (transfers.length) {
            const title = document.createElement("div");
            title.className = "expense-settlement-title";
            title.textContent = "Liquidación mínima";
            container.appendChild(title);

            transfers.forEach(transfer => {
                const row = document.createElement("div");
                row.className = "expense-settlement-row";
                const copy = document.createElement("span");
                copy.textContent =
                    memberName(transfer.from) + " → " +
                    memberName(transfer.to);
                const amount = document.createElement("strong");
                amount.textContent = formatMoney(transfer.amount);
                row.append(copy, amount);
                container.appendChild(row);
            });
        } else if (hasSavedSplits) {
            const done = document.createElement("p");
            done.className = "expense-split-note";
            done.textContent = "Todo está equilibrado.";
            container.appendChild(done);
        }

        const controls = document.createElement("div");
        controls.className = "expense-split-controls";
        controls.innerHTML =
            '<span>Reparto personalizado por gasto</span>';

        expenses.forEach(expense => {
            const saved = expenseSplits.get(String(expense.id)) || [];
            const defaultAmount = Number(expense.amount || 0) / going.length;
            const card = document.createElement("div");
            card.className = "expense-split-editor";

            const title = document.createElement("strong");
            title.textContent = expense.title + " · " + formatMoney(expense.amount);
            card.appendChild(title);

            going.forEach(member => {
                const row = document.createElement("label");
                row.className = "expense-split-input-row";
                const text = document.createElement("span");
                text.textContent = memberName(member.user_id);
                const input = document.createElement("input");
                input.type = "number";
                input.min = "0";
                input.step = "0.01";
                input.dataset.expenseId = expense.id;
                input.dataset.userId = member.user_id;
                const match = saved.find(
                    split => String(split.user_id) === String(member.user_id)
                );
                input.value = match
                    ? Number(match.amount).toFixed(2)
                    : defaultAmount.toFixed(2);
                row.append(text, input);
                card.appendChild(row);
            });

            const save = document.createElement("button");
            save.type = "button";
            save.className = "expense-split-save";
            save.textContent = "Guardar reparto";
            save.addEventListener("click", async () => {
                const inputs = [...card.querySelectorAll("input")];
                const splits = inputs
                    .map(input => ({
                        user_id: input.dataset.userId,
                        amount: Number(input.value || 0)
                    }))
                    .filter(split => split.amount > 0);

                const sum = splits.reduce((total, split) => total + split.amount, 0);
                if (Math.abs(sum - Number(expense.amount)) > 0.011) {
                    alert("El reparto debe sumar exactamente " + formatMoney(expense.amount) + ".");
                    return;
                }

                save.disabled = true;
                const ok = await replaceExpenseSplits(expense.id, splits);
                save.disabled = false;

                if (!ok) {
                    alert("No se ha podido guardar el reparto.");
                    return;
                }

                expenseSplits.set(String(expense.id), splits);
                renderExpenseSplit();
                updateCommandCenter();
            });

            controls.appendChild(card);
        });

        container.appendChild(controls);
    }

    function setupTaskFilters() {
        const filters = document.querySelectorAll("[data-task-filter]");
        filters.forEach(button => {
            button.addEventListener("click", () => {
                taskFilter = button.dataset.taskFilter || "all";
                renderTasks();
            });
        });
    }

    async function setupEventShare() {
        const button = document.getElementById("shareEventButton");
        if (!button || !currentEvent) return;

        button.addEventListener("click", async () => {
            const url = window.location.href;
            const shareData = {
                title: currentEvent.title || "Evento de Curruscos",
                text: "Mira este evento en Curruscos.",
                url
            };

            button.disabled = true;

            try {
                if (navigator.share) {
                    await navigator.share(shareData);
                    button.textContent = "✓ Compartido";
                } else if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(url);
                    button.textContent = "✓ Enlace copiado";
                } else {
                    window.prompt("Copia el enlace del evento:", url);
                    button.textContent = "✓ Enlace listo";
                }
            } catch (error) {
                if (error?.name !== "AbortError") {
                    alert("No se ha podido compartir el evento.");
                }
            } finally {
                setTimeout(() => {
                    button.disabled = false;
                    button.textContent = "↗ Compartir evento";
                }, 1800);
            }
        });
    }

    function setupEventDeletion() {
        const button = document.getElementById("deleteEventButton");
        if (!button || !currentEvent) return;

        button.hidden = !canManageEvent();

        if (!canManageEvent()) return;

        button.addEventListener("click", async () => {
            const confirmed = confirm(
                "¿Eliminar «" + (currentEvent.title || "este evento") + "»? Esta acción no se puede deshacer."
            );
            if (!confirmed) return;

            button.disabled = true;
            button.textContent = "Eliminando…";

            const deleted = await deleteGroupEvent(currentEvent.id);

            if (!deleted) {
                button.disabled = false;
                button.textContent = "Eliminar evento";
                alert("No se ha podido eliminar el evento.");
                return;
            }

            window.location.href = "eventos.html";
        });
    }

    async function setupHistoryButton() {
        const button = document.getElementById("saveToHistoryButton");
        if (!button || !currentEvent) return;

        const existing = await getHistoryEntryForEvent(currentEvent.id);
        if (existing) {
            button.textContent = "✓ En la historia";
            button.disabled = true;
            button.classList.add("save-history-success");
            return;
        }

        button.addEventListener("click", async () => {
            button.disabled = true;
            button.textContent = "Guardando…";

            const entry = await createHistoryEntryForEvent(currentEvent);

            if (!entry) {
                button.disabled = false;
                button.textContent = "📖 Guardar en historia";
                alert("No se ha podido guardar el evento en la historia.");
                return;
            }

            button.textContent = "✓ En la historia";
            button.classList.add("save-history-success");
        });
    }

    function renderRelatedTrip() {
        const container = document.getElementById("eventTripContext");
        if (!container) return;

        if (!relatedTrip) {
            if (!canManageEvent()) {
                container.hidden = true;
                container.innerHTML = "";
                return;
            }

            container.hidden = false;
            container.innerHTML =
                '<div class="event-trip-context-inner">' +
                    '<div>' +
                        '<span class="event-trip-kicker">VIAJE</span>' +
                        '<strong>Planificad el viaje del evento.</strong>' +
                        '<span>Podéis comparar opciones, votar y repartir el presupuesto.</span>' +
                    '</div>' +
                    '<button id="createTripFromEventButton" type="button" class="button button-secondary">＋ Crear viaje</button>' +
                '</div>';

            const button = document.getElementById("createTripFromEventButton");
            if (button) {
                button.addEventListener("click", async () => {
                    button.disabled = true;
                    button.textContent = "Creando…";
                    const tripId = await createTripForEvent(currentEvent.id);
                    if (!tripId) {
                        button.disabled = false;
                        button.textContent = "＋ Crear viaje";
                        alert("No se ha podido crear el viaje.");
                        return;
                    }
                    relatedTrip = await getTripForEvent(tripId);
                    renderRelatedTrip();
                });
            }
            return;
        }

        const dates = relatedTrip.start_date
            ? relatedTrip.start_date + (relatedTrip.end_date ? " → " + relatedTrip.end_date : "")
            : "Fechas por definir";

        container.hidden = false;
        container.innerHTML =
            '<div class="event-trip-context-inner">' +
                '<div>' +
                    '<span class="event-trip-kicker">PARTE DE UN VIAJE</span>' +
                    '<strong>' + escapeHtml(relatedTrip.title || "Viaje") + '</strong>' +
                    '<span>' + escapeHtml((relatedTrip.destination || "Destino por definir") + " · " + dates) + '</span>' +
                '</div>' +
                '<a href="viajes.html" class="button button-secondary">Abrir Viajes →</a>' +
            '</div>';
    }

    function populateEditTripSelect() {
        const select = document.getElementById("editEventTrip");

        if (!select) {
            return;
        }

        select.innerHTML = '<option value="">Sin viaje relacionado</option>';

        getGroupTripsForEvent().then(trips => {
            trips.forEach(trip => {
                const option = document.createElement("option");
                option.value = trip.id;
                option.textContent =
                    trip.destination
                        ? trip.title + " · " + trip.destination
                        : trip.title;
                select.appendChild(option);
            });

            select.value = currentEvent.trip_id || "";
        });
    }

    function updateProgress() {
        const answeredParticipants = members.filter(member => {
            const participant = participants.find(
                item => String(item.user_id) === String(member.user_id)
            );
            return participant?.status === "yes" || participant?.status === "no";
        }).length;

        const participantProgress =
            members.length ? answeredParticipants / members.length : 0;

        const taskProgress =
            tasks.length
                ? tasks.filter(
                    task => task.completed
                  ).length /
                  tasks.length
                : null;

        const components =
            [participantProgress];

        if (taskProgress !== null) {
            components.push(taskProgress);
        }

        const progress =
            Math.round(
                components.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                ) /
                components.length *
                100
            );

        document.getElementById(
            "progressFill"
        ).style.width =
            progress + "%";

        document.getElementById(
            "progressText"
        ).textContent =
            progress + "%";

        renderExpenseSplit();
        updateCommandCenter();
    }

    function updateCommandCenter() {
        const yes = participants.filter(item => item.status === "yes").length;
        const answered = participants.filter(item => item.status === "yes" || item.status === "no").length;
        const pending = Math.max(0, members.length - answered);
        const completed = tasks.filter(task => task.completed).length;
        const taskPercent = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
        const total = expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
        const going = getGoingMembers();

        const people = document.getElementById("commandPeople");
        const taskEl = document.getElementById("commandTasks");
        const cost = document.getElementById("commandCost");
        const headline = document.getElementById("eventCommandHeadline");
        const subline = document.getElementById("eventCommandSubline");
        const action = document.getElementById("eventCommandAction");

        if (people) people.textContent = yes + "/" + members.length;
        if (taskEl) taskEl.textContent = taskPercent + "%";
        if (cost) cost.textContent = formatMoney(total);

        const setAction = (label, target) => {
            if (!action) return;
            action.hidden = false;
            action.textContent = label;
            action.onclick = () => {
                const el = document.getElementById(target);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
            };
        };

        if (action) {
            action.hidden = true;
            action.onclick = null;
        }

        if (headline && subline) {
            if (!members.length) {
                headline.textContent = "El evento está listo para organizarse.";
                subline.textContent = "Añade miembros al grupo para empezar a coordinarlo.";
                setAction("Ir a miembros →", "participantsList");
            } else if (pending > 0) {
                headline.textContent = pending + (pending === 1 ? " persona aún no ha respondido." : " personas aún no han respondido.");
                subline.textContent = yes + " confirmadas · " + pending + " pendientes.";
                setAction("Revisar asistencia →", "participantsList");
            } else if (tasks.length && taskPercent < 100) {
                headline.textContent = "La asistencia está cerrada, pero aún quedan tareas.";
                subline.textContent = completed + " de " + tasks.length + " tareas completadas.";
                setAction("Ver tareas pendientes →", "tasksList");
            } else if (expenses.length && going.length) {
                const balances = calculateBalances();
                const unresolved = [...balances.values()].some(value => Math.abs(value) > 0.01);
                headline.textContent = unresolved
                    ? "Organización completa · queda liquidar gastos."
                    : "Evento preparado y cuentas equilibradas.";
                subline.textContent = unresolved
                    ? "Hay " + expenses.length + " gasto" + (expenses.length === 1 ? "" : "s") + " y todavía hay pagos pendientes entre el grupo."
                    : "Asistencia, tareas y gastos están organizados.";
                setAction(unresolved ? "Revisar liquidación →" : "Abrir chat del evento →", unresolved ? "expenseSplit" : "eventChatButton");
            } else {
                headline.textContent = "El evento ya tiene una base sólida.";
                subline.textContent = "Ahora podéis completar asistencia, tareas y presupuesto.";
                setAction("Abrir chat del evento →", "eventChatButton");
            }
        }
    }
    function updateStatus() {
        const status = document.getElementById("eventStatus");
        if (!status) return;

        const answered = members.filter(member => {
            const participant = participants.find(
                item => String(item.user_id) === String(member.user_id)
            );
            return participant?.status === "yes" || participant?.status === "no";
        }).length;

        const pending = Math.max(0, members.length - answered);
        const incompleteTasks = tasks.filter(task => !task.completed).length;

        if (!members.length) {
            status.textContent = "🟡 Añade miembros para organizar";
            return;
        }

        if (pending > 0) {
            status.textContent =
                "🟡 Faltan " + pending + (pending === 1 ? " respuesta" : " respuestas");
            return;
        }

        if (incompleteTasks > 0) {
            status.textContent =
                "🟠 " + incompleteTasks + (incompleteTasks === 1 ? " tarea pendiente" : " tareas pendientes");
            return;
        }

        if (!tasks.length) {
            status.textContent = "🟡 Asistencia confirmada · sin tareas";
            return;
        }

        status.textContent = "🟢 Todo preparado";
    }

    async function load() {
        currentEvent =
            await getGroupEvent(
                eventId
            );

        if (!currentEvent) {
            document.getElementById(
                "eventTitle"
            ).textContent =
                "Evento no encontrado";
            return;
        }

        members =
            await getGroupMembers(
                currentGroup.id
            );

        const [participantData, taskData, expenseData] = await Promise.all([
            getEventParticipants(
                currentEvent.id
            ),
            getEventTasks(
                currentEvent.id
            ),
            getEventExpenses(
                currentEvent.id
            )
        ]);

        participants =
            participantData || [];

        tasks =
            taskData || [];

        expenses = expenseData || [];

        const splitRows = await Promise.all(
            expenses.map(expense => getExpenseSplits(expense.id))
        );

        expenseSplits = new Map(
            expenses.map((expense, index) => [
                String(expense.id),
                splitRows[index] || []
            ])
        );

        document.getElementById(
            "eventTitle"
        ).textContent =
            currentEvent.title ||
            "Sin título";

        document.getElementById(
            "eventDescription"
        ).textContent =
            currentEvent.description ||
            "Sin descripción";

        document.getElementById(
            "eventDate"
        ).textContent =
            currentEvent.date ||
            "Sin fecha";

        document.getElementById(
            "eventTime"
        ).textContent =
            currentEvent.time ||
            "Sin hora";

        document.getElementById(
            "eventLocation"
        ).textContent =
            currentEvent.location ||
            "Sin lugar";

        relatedTrip = await getTripForEvent(currentEvent.trip_id);
        renderRelatedTrip();

        const editButton =
            document.getElementById(
                "editEventButton"
            );

        editButton.hidden =
            !canManageEvent();

        renderMyAttendance();
        renderParticipants();
        renderTaskAssignees();
        renderTasks();
        renderExpenses();
        updateProgress();
        updateStatus();
        updateCommandCenter();

        setupForms();
        setupTaskFilters();
        await setupHistoryButton();
        await setupEventShare();
        setupEventDeletion();
    }

    function setupForms() {
        const editButton =
            document.getElementById(
                "editEventButton"
            );

        const editForm =
            document.getElementById(
                "editEventForm"
            );

        const cancelEdit =
            document.getElementById(
                "cancelEditEventButton"
            );

        editButton.addEventListener(
            "click",
            () => {
                document.getElementById(
                    "editEventTitle"
                ).value =
                    currentEvent.title || "";

                document.getElementById(
                    "editEventDate"
                ).value =
                    currentEvent.date || "";

                document.getElementById(
                    "editEventTime"
                ).value =
                    currentEvent.time || "";

                document.getElementById(
                    "editEventLocation"
                ).value =
                    currentEvent.location || "";

                document.getElementById(
                    "editEventDescription"
                ).value =
                    currentEvent.description || "";

                populateEditTripSelect();

                editButton.hidden =
                    true;

                editForm.hidden =
                    false;
            }
        );

        cancelEdit.addEventListener(
            "click",
            () => {
                editForm.hidden =
                    true;

                editButton.hidden =
                    !canManageEvent();
            }
        );

        editForm.addEventListener(
            "submit",
            async event => {
                event.preventDefault();

                const saveButton =
                    document.getElementById(
                        "saveEditEventButton"
                    );

                saveButton.disabled =
                    true;

                saveButton.textContent =
                    "Guardando...";

                try {
                    const updated =
                        await updateGroupEvent(
                            currentEvent.id,
                            {
                                title:
                                    document.getElementById(
                                        "editEventTitle"
                                    ).value.trim(),

                                date:
                                    document.getElementById(
                                        "editEventDate"
                                    ).value,

                                time:
                                    document.getElementById(
                                        "editEventTime"
                                    ).value,

                                location:
                                    document.getElementById(
                                        "editEventLocation"
                                    ).value.trim(),

                                description:
                                    document.getElementById(
                                        "editEventDescription"
                                    ).value.trim(),

                                trip_id:
                                    document.getElementById(
                                        "editEventTrip"
                                    )?.value || null
                            }
                        );

                    if (!updated) {
                        throw new Error(
                            "No se han podido guardar los cambios."
                        );
                    }

                    currentEvent =
                        updated;

                    relatedTrip =
                        await getTripForEvent(currentEvent.trip_id);

                    renderRelatedTrip();

                    editForm.hidden =
                        true;

                    editButton.hidden =
                        !canManageEvent();

                    document.getElementById(
                        "eventTitle"
                    ).textContent =
                        currentEvent.title ||
                        "Sin título";

                    document.getElementById(
                        "eventDescription"
                    ).textContent =
                        currentEvent.description ||
                        "Sin descripción";

                    document.getElementById(
                        "eventDate"
                    ).textContent =
                        currentEvent.date ||
                        "Sin fecha";

                    document.getElementById(
                        "eventTime"
                    ).textContent =
                        currentEvent.time ||
                        "Sin hora";

                    document.getElementById(
                        "eventLocation"
                    ).textContent =
                        currentEvent.location ||
                        "Sin lugar";
                } catch (error) {
                    alert(
                        getSupabaseErrorMessage(
                            error,
                            "No se han podido guardar los cambios."
                        )
                    );
                } finally {
                    saveButton.disabled =
                        false;

                    saveButton.textContent =
                        "Guardar cambios";
                }
            }
        );

        document.getElementById(
            "taskForm"
        ).addEventListener(
            "submit",
            async event => {
                event.preventDefault();

                const title =
                    document.getElementById(
                        "taskTitle"
                    ).value.trim();

                const assignee =
                    document.getElementById(
                        "taskAssignee"
                    ).value;

                if (!title) {
                    return;
                }

                const button =
                    event.currentTarget.querySelector(
                        'button[type="submit"]'
                    );

                button.disabled =
                    true;

                try {
                    const task =
                        await createEventTask(
                            currentEvent.id,
                            title,
                            assignee
                        );

                    if (!task) {
                        throw new Error(
                            "No se ha podido crear la tarea."
                        );
                    }

                    tasks.push(task);

                    event.currentTarget.reset();

                    renderTasks();
                    updateProgress();
                    updateStatus();
                } catch (error) {
                    alert(
                        getSupabaseErrorMessage(
                            error,
                            "No se ha podido crear la tarea."
                        )
                    );
                } finally {
                    button.disabled =
                        false;
                }
            }
        );

        document.getElementById(
            "expenseForm"
        ).addEventListener(
            "submit",
            async event => {
                event.preventDefault();

                const title =
                    document.getElementById(
                        "expenseTitle"
                    ).value.trim();

                const amount =
                    Number(
                        document.getElementById(
                            "expenseAmount"
                        ).value
                    );

                const payer =
                    document.getElementById(
                        "expensePayer"
                    ).value;

                if (
                    !title ||
                    !Number.isFinite(amount) ||
                    amount <= 0 ||
                    !payer
                ) {
                    alert(
                        "Completa el concepto, la cantidad y quién lo ha pagado."
                    );
                    return;
                }

                const button =
                    event.currentTarget.querySelector(
                        'button[type="submit"]'
                    );

                button.disabled =
                    true;

                try {
                    const expense =
                        await createEventExpense(
                            currentEvent.id,
                            title,
                            amount,
                            payer
                        );

                    if (!expense) {
                        throw new Error(
                            "No se ha podido crear el gasto."
                        );
                    }

                    expenses.push(expense);
                    expenseSplits.set(String(expense.id), []);

                    event.currentTarget.reset();

                    renderExpenses();
                    updateProgress();
                    updateStatus();
                    updateCommandCenter();
                } catch (error) {
                    alert(
                        getSupabaseErrorMessage(
                            error,
                            "No se ha podido crear el gasto."
                        )
                    );
                } finally {
                    button.disabled =
                        false;
                }
            }
        );

        const payerSelect =
            document.getElementById(
                "expensePayer"
            );

        payerSelect.innerHTML =
            '<option value="">Seleccionar persona</option>';

        members.forEach(member => {
            const option = document.createElement("option");

            option.value = member.user_id;
            option.textContent = memberName(member.user_id);

            const status = participants.find(
                item => String(item.user_id) === String(member.user_id)
            )?.status;

            if (status === "yes") {
                option.textContent += " · va";
            } else if (status === "no") {
                option.textContent += " · no va";
            } else {
                option.textContent += " · pendiente";
            }

            payerSelect.appendChild(option);
        });

        if (members.some(member => String(member.user_id) === String(currentUser.id))) {
            payerSelect.value = currentUser.id;
        }
    }

    await load();
});
