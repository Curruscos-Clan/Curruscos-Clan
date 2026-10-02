/* =========================================================
   CURRUSCOS — DETALLE DE EVENTO
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
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
    let relatedTrip = null;

    const params =
        new URLSearchParams(
            window.location.search
        );

    const eventId =
        params.get("id");

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

    function renderParticipants() {
        const container =
            document.getElementById(
                "participantsList"
            );

        container.innerHTML = "";

        let yes = 0;
        let no = 0;
        let pending = 0;

        members.forEach(member => {
            const participant =
                participants.find(
                    item =>
                        String(item.user_id) ===
                        String(member.user_id)
                );

            const status =
                participant?.status || "pending";

            if (status === "yes") {
                yes++;
            } else if (status === "no") {
                no++;
            } else {
                pending++;
            }

            const row =
                document.createElement("div");

            row.className =
                "participant-row";

            const info =
                document.createElement("div");

            info.className =
                "participant-info";

            const avatar =
                document.createElement("div");

            avatar.className =
                "participant-avatar";

            avatar.textContent =
                memberName(
                    member.user_id
                ).charAt(0).toUpperCase();

            const copy =
                document.createElement("div");

            copy.className =
                "participant-copy";

            const strong =
                document.createElement("strong");

            strong.textContent =
                memberName(
                    member.user_id
                );

            const badge =
                document.createElement("span");

            badge.className =
                "participant-status " +
                statusClass(status);

            badge.textContent =
                statusLabel(status);

            copy.append(
                strong,
                badge
            );

            info.append(
                avatar,
                copy
            );

            const actions =
                document.createElement("div");

            actions.className =
                "participant-actions";

            [
                ["yes", "Voy"],
                ["pending", "Pendiente"],
                ["no", "No voy"]
            ].forEach(
                pair => {
                    const button =
                        document.createElement("button");

                    button.type =
                        "button";

                    button.className =
                        "participant-choice";

                    button.textContent =
                        pair[1];

                    if (status === pair[0]) {
                        button.classList.add(
                            "selected"
                        );
                    }

                    const canEdit =
                        canManageGroup() ||
                        String(member.user_id) ===
                            String(currentUser.id);

                    button.disabled =
                        !canEdit;

                    if (canEdit) {
                        button.addEventListener(
                            "click",
                            async () => {
                                button.disabled =
                                    true;

                                const updated =
                                    await setEventParticipant(
                                        currentEvent.id,
                                        member.user_id,
                                        pair[0]
                                    );

                                button.disabled =
                                    false;

                                if (!updated) {
                                    alert(
                                        "No se ha podido actualizar la participación."
                                    );
                                    return;
                                }

                                participants =
                                    participants.filter(
                                        item =>
                                            String(
                                                item.user_id
                                            ) !==
                                            String(
                                                member.user_id
                                            )
                                    );

                                participants.push(
                                    updated
                                );

                                renderParticipants();
                                updateProgress();
                                updateStatus();
                            }
                        );
                    }

                    actions.appendChild(
                        button
                    );
                }
            );

            row.append(
                info,
                actions
            );

            container.appendChild(
                row
            );
        });

        document.getElementById(
            "participantsYes"
        ).textContent =
            String(yes);

        document.getElementById(
            "participantsPending"
        ).textContent =
            String(pending);

        document.getElementById(
            "participantsNo"
        ).textContent =
            String(no);

        if (!members.length) {
            container.innerHTML =
                '<div class="empty-state">No hay miembros en este grupo.</div>';
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
        const container =
            document.getElementById(
                "tasksList"
            );

        container.innerHTML = "";

        if (!tasks.length) {
            container.innerHTML =
                '<div class="task-empty">Todavía no hay tareas.</div>';
            return;
        }

        tasks.forEach(task => {
            const card =
                document.createElement("article");

            card.className =
                "task-card";

            if (task.completed) {
                card.classList.add(
                    "completed"
                );
            }

            const checkbox =
                document.createElement("input");

            checkbox.type =
                "checkbox";

            checkbox.checked =
                Boolean(task.completed);

            const canEdit =
                canManageGroup() ||
                task.created_by ===
                    currentUser.id ||
                task.assigned_to ===
                    currentUser.id;

            checkbox.disabled =
                !canEdit;

            checkbox.addEventListener(
                "change",
                async () => {
                    const next =
                        checkbox.checked;

                    checkbox.disabled =
                        true;

                    const updated =
                        await updateEventTask(
                            task.id,
                            next
                        );

                    checkbox.disabled =
                        !canEdit;

                    if (!updated) {
                        checkbox.checked =
                            !next;

                        alert(
                            "No se ha podido actualizar la tarea."
                        );
                        return;
                    }

                    task.completed =
                        updated.completed;

                    renderTasks();
                    updateProgress();
                    updateStatus();
                }
            );

            const copy =
                document.createElement("div");

            copy.className =
                "task-copy";

            const title =
                document.createElement("strong");

            title.textContent =
                task.title || "Tarea";

            const assignee =
                document.createElement("span");

            assignee.textContent =
                task.assigned_to
                    ? "Responsable: " +
                      memberName(
                          task.assigned_to
                      )
                    : "Sin responsable";

            copy.append(
                title,
                assignee
            );

            const right =
                document.createElement("div");

            right.className =
                "task-actions";

            if (
                canManageGroup() ||
                task.created_by ===
                    currentUser.id
            ) {
                const remove =
                    document.createElement("button");

                remove.type =
                    "button";

                remove.className =
                    "task-remove-button";

                remove.textContent =
                    "Eliminar";

                remove.addEventListener(
                    "click",
                    async () => {
                        if (
                            !confirm(
                                "¿Eliminar esta tarea?"
                            )
                        ) {
                            return;
                        }

                        remove.disabled =
                            true;

                        const deleted =
                            await deleteEventTask(
                                task.id
                            );

                        if (!deleted) {
                            remove.disabled =
                                false;

                            alert(
                                "No se ha podido eliminar la tarea."
                            );

                            return;
                        }

                        tasks =
                            tasks.filter(
                                item =>
                                    String(
                                        item.id
                                    ) !==
                                    String(
                                        task.id
                                    )
                            );

                        renderTasks();
                        updateProgress();
                        updateStatus();
                    }
                );

                right.appendChild(
                    remove
                );
            }

            card.append(
                checkbox,
                copy,
                right
            );

            container.appendChild(
                card
            );
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

        expenses.forEach(
            expense => {
                const card =
                    document.createElement("article");

                card.className =
                    "expense-card";

                const info =
                    document.createElement("div");

                info.className =
                    "expense-info";

                const title =
                    document.createElement("strong");

                title.textContent =
                    expense.title || "Gasto";

                const meta =
                    document.createElement("span");

                meta.textContent =
                    "Pagado por " +
                    memberName(
                        expense.paid_by
                    );

                info.append(
                    title,
                    meta
                );

                const right =
                    document.createElement("div");

                right.className =
                    "expense-card-right";

                const amount =
                    document.createElement("strong");

                amount.textContent =
                    formatMoney(
                        expense.amount
                    );

                right.appendChild(
                    amount
                );

                if (
                    canManageGroup() ||
                    expense.created_by ===
                        currentUser.id
                ) {
                    const remove =
                        document.createElement("button");

                    remove.type =
                        "button";

                    remove.className =
                        "expense-remove-button";

                    remove.textContent =
                        "Eliminar";

                    remove.addEventListener(
                        "click",
                        async () => {
                            if (
                                !confirm(
                                    "¿Eliminar este gasto?"
                                )
                            ) {
                                return;
                            }

                            remove.disabled =
                                true;

                            const deleted =
                                await deleteEventExpense(
                                    expense.id
                                );

                            if (!deleted) {
                                remove.disabled =
                                    false;

                                alert(
                                    "No se ha podido eliminar el gasto."
                                );
                                return;
                            }

                            expenses =
                                expenses.filter(
                                    item =>
                                        String(
                                            item.id
                                        ) !==
                                        String(
                                            expense.id
                                        )
                                );

                            renderExpenses();
                        }
                    );

                    right.appendChild(
                        remove
                    );
                }

                card.append(
                    info,
                    right
                );

                container.appendChild(
                    card
                );
            }
        );

        renderExpenseSplit();
    }

    function renderExpenseSplit() {
        const container =
            document.getElementById(
                "expenseSplit"
            );

        container.innerHTML = "";

        if (
            !members.length ||
            !expenses.length
        ) {
            return;
        }

        const going =
            members.filter(member => {
                const participant =
                    participants.find(
                        item =>
                            String(
                                item.user_id
                            ) ===
                            String(
                                member.user_id
                            )
                    );

                return participant?.status ===
                    "yes";
            });

        if (!going.length) {
            return;
        }

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

        const share =
            total / going.length;

        const paidBy =
            new Map();

        expenses.forEach(
            expense => {
                const id =
                    String(
                        expense.paid_by
                    );

                paidBy.set(
                    id,
                    (
                        paidBy.get(id) ||
                        0
                    ) +
                    (
                        Number(
                            expense.amount
                        ) || 0
                    )
                );
            }
        );

        const heading =
            document.createElement("div");

        heading.className =
            "expense-split-title";

        heading.textContent =
            "💸 Reparto entre quienes van";

        const note =
            document.createElement("p");

        note.className =
            "expense-split-note";

        note.textContent =
            "Cada persona asume " +
            formatMoney(share) +
            " del total.";

        container.append(
            heading,
            note
        );

        going.forEach(member => {
            const paid =
                paidBy.get(
                    String(
                        member.user_id
                    )
                ) || 0;

            const balance =
                paid - share;

            const row =
                document.createElement("div");

            row.className =
                "expense-person-row";

            const name =
                document.createElement("span");

            name.textContent =
                memberName(
                    member.user_id
                );

            const result =
                document.createElement("strong");

            if (balance > 0.005) {
                result.textContent =
                    "A favor " +
                    formatMoney(balance);
                result.className =
                    "expense-balance-positive";
            } else if (balance < -0.005) {
                result.textContent =
                    "Debe " +
                    formatMoney(
                        Math.abs(balance)
                    );
                result.className =
                    "expense-balance-negative";
            } else {
                result.textContent =
                    "Equilibrado";
                result.className =
                    "expense-balance-neutral";
            }

            row.append(
                name,
                result
            );

            container.appendChild(
                row
            );
        });
    }

    function renderRelatedTrip() {
        const container = document.getElementById("eventTripContext");

        if (!container) {
            return;
        }

        if (!relatedTrip) {
            container.hidden = true;
            container.innerHTML = "";
            return;
        }

        const dates = relatedTrip.start_date
            ? relatedTrip.start_date +
              (relatedTrip.end_date ? " → " + relatedTrip.end_date : "")
            : "Fechas por definir";

        container.hidden = false;
        container.innerHTML =
            '<div class="event-trip-context-inner">' +
                '<div>' +
                    '<span class="event-trip-kicker">PARTE DE UN VIAJE</span>' +
                    '<strong>' +
                        escapeHtml(relatedTrip.title || "Viaje") +
                    '</strong>' +
                    '<span>' +
                        escapeHtml(
                            (relatedTrip.destination || "Destino por definir") +
                            " · " +
                            dates
                        ) +
                    '</span>' +
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
        const participantProgress =
            members.length
                ? members.filter(member => {
                    const participant =
                        participants.find(
                            item =>
                                String(
                                    item.user_id
                                ) ===
                                String(
                                    member.user_id
                                )
                        );

                    return participant?.status ===
                        "yes";
                }).length /
                members.length
                : 0;

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
    }

    function updateCommandCenter() {
        const yes = participants.filter(item => item.status === "yes").length;
        const pending = members.length - participants.filter(item => item.status === "yes" || item.status === "no").length;
        const completed = tasks.filter(task => task.completed).length;
        const taskPercent = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
        const total = expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

        const people = document.getElementById("commandPeople");
        const taskEl = document.getElementById("commandTasks");
        const cost = document.getElementById("commandCost");
        const headline = document.getElementById("eventCommandHeadline");
        const subline = document.getElementById("eventCommandSubline");

        if (people) people.textContent = yes + "/" + members.length;
        if (taskEl) taskEl.textContent = taskPercent + "%";
        if (cost) cost.textContent = formatMoney(total);

        if (headline && subline) {
            if (!members.length) {
                headline.textContent = "El evento está listo para organizarse.";
                subline.textContent = "Añade miembros al grupo para empezar a coordinarlo.";
            } else if (pending > 0) {
                headline.textContent = pending + (pending === 1 ? " persona aún no ha respondido." : " personas aún no han respondido.");
                subline.textContent = yes + " confirmadas · " + pending + " pendientes.";
            } else if (tasks.length && taskPercent < 100) {
                headline.textContent = "La asistencia está cerrada, pero aún quedan tareas.";
                subline.textContent = completed + " de " + tasks.length + " tareas completadas.";
            } else if (expenses.length) {
                headline.textContent = "El plan ya está bastante definido.";
                subline.textContent = "Hay " + expenses.length + " gasto" + (expenses.length === 1 ? "" : "s") + " registrado" + (expenses.length === 1 ? "" : "s") + ".";
            } else {
                headline.textContent = "El evento ya tiene una base sólida.";
                subline.textContent = "Ahora podéis completar asistencia, tareas y presupuesto.";
            }
        }
    }

    function updateStatus() {
        const status =
            document.getElementById(
                "eventStatus"
            );

        if (!tasks.length) {
            status.textContent =
                "🟡 Organización pendiente";
            return;
        }

        const completed =
            tasks.filter(
                task => task.completed
            ).length;

        if (
            completed ===
            tasks.length
        ) {
            status.textContent =
                "🟢 Todo preparado";
        } else {
            status.textContent =
                "🟠 En organización";
        }
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

        const [
            participantData,
            taskData,
            expenseData
        ] = await Promise.all([
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

        expenses =
            expenseData || [];

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

        renderParticipants();
        renderTaskAssignees();
        renderTasks();
        renderExpenses();
        updateProgress();
        updateStatus();

        setupForms();
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

                    expenses.push(
                        expense
                    );

                    event.currentTarget.reset();

                    renderExpenses();
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
            const option =
                document.createElement("option");

            option.value =
                member.user_id;

            option.textContent =
                memberName(
                    member.user_id
                );

            payerSelect.appendChild(
                option
            );
        });
    }

    await load();
});
