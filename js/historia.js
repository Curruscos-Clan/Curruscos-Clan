/* =========================================================
   CURRUSCOS — HISTORIA
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    const access = await window.curruscosReady;

    if (!access) {
        return;
    }

    await loadHistoryPage();
    setupHistoryForm();
});

async function loadHistoryPage() {
    const timeline =
        document.getElementById("historyTimeline");

    timeline.innerHTML =
        "<p>Cargando historia...</p>";

    const historyEntries =
        await getGroupHistory();

    if (!historyEntries.length) {
        timeline.innerHTML = `
            <div class="empty-history">
                <h2>Aún no hay historia</h2>
                <p>
                    Añadid vuestro primer momento importante.
                </p>
            </div>
        `;
        return;
    }

    timeline.innerHTML = "";

    const groupedByYear = {};

    historyEntries.forEach(entry => {
        const year =
            entry.event_date
                ? entry.event_date.substring(0, 4)
                : "Sin fecha";

        if (!groupedByYear[year]) {
            groupedByYear[year] = [];
        }

        groupedByYear[year].push(entry);
    });

    Object.keys(groupedByYear)
        .sort((a, b) => b.localeCompare(a))
        .forEach(year => {
            const yearSection =
                document.createElement("div");

            yearSection.className =
                "history-year";

            const yearTitle =
                document.createElement("h2");

            yearTitle.className =
                "history-year-title";

            yearTitle.textContent =
                year;

            yearSection.appendChild(
                yearTitle
            );

            groupedByYear[year].forEach(entry => {
                const card =
                    document.createElement("article");

                card.className =
                    "history-entry";

                const profile =
                    entry.profiles;

                const creator =
                    profile?.display_name ||
                    profile?.username ||
                    "Miembro del grupo";

                const formattedDate =
                    entry.event_date
                        ? new Date(
                            entry.event_date +
                            "T00:00:00"
                        ).toLocaleDateString(
                            "es-ES",
                            {
                                day: "numeric",
                                month: "long"
                            }
                        )
                        : "Fecha sin definir";

                const date =
                    document.createElement("div");

                date.className =
                    "history-date";

                date.textContent =
                    formattedDate;

                const title =
                    document.createElement("h3");

                title.textContent =
                    entry.title || "Momento";

                card.append(
                    date,
                    title
                );

                if (entry.description) {
                    const description =
                        document.createElement("div");

                    description.className =
                        "history-description";

                    description.textContent =
                        entry.description;

                    card.appendChild(
                        description
                    );
                }

                const meta =
                    document.createElement("div");

                meta.className =
                    "history-meta";

                meta.textContent =
                    "Añadido por " + creator;

                card.appendChild(
                    meta
                );

                const canDelete =
                    access.currentGroup.role === "owner" ||
                    access.currentGroup.role === "admin" ||
                    entry.created_by === access.user.id;

                if (canDelete) {
                    const remove =
                        document.createElement("button");

                    remove.type = "button";
                    remove.className =
                        "delete-history";
                    remove.dataset.historyId =
                        entry.id;
                    remove.textContent =
                        "Eliminar";

                    card.appendChild(
                        remove
                    );
                }

                yearSection.appendChild(
                    card
                );
            });

            timeline.appendChild(
                yearSection
            );
        });

    setupDeleteButtons();
}

function setupHistoryForm() {
    const newButton =
        document.getElementById(
            "newHistoryButton"
        );

    const form =
        document.getElementById(
            "historyForm"
        );

    const cancelButton =
        document.getElementById(
            "cancelHistoryButton"
        );

    const saveButton =
        document.getElementById(
            "saveHistoryButton"
        );

    if (!newButton || !form || !cancelButton || !saveButton) {
        return;
    }

    if (accessSafeRole() === "member") {
        // Members may still add history entries.
    }

    newButton.addEventListener(
        "click",
        () => {
            form.classList.add("active");

            document.getElementById(
                "historyTitle"
            )?.focus();
        }
    );

    cancelButton.addEventListener(
        "click",
        () => {
            form.classList.remove("active");
        }
    );

    saveButton.addEventListener(
        "click",
        saveHistoryEntry
    );
}

function accessSafeRole() {
    return window.curruscosCurrentAccess?.currentGroup?.role ||
        "member";
}

async function saveHistoryEntry() {
    const title =
        document.getElementById(
            "historyTitle"
        ).value.trim();

    const date =
        document.getElementById(
            "historyDate"
        ).value;

    const description =
        document.getElementById(
            "historyDescription"
        ).value.trim();

    if (!title) {
        alert("El título es obligatorio.");
        return;
    }

    if (!date) {
        alert("La fecha es obligatoria.");
        return;
    }

    const button =
        document.getElementById(
            "saveHistoryButton"
        );

    button.disabled = true;
    button.textContent = "Guardando...";

    try {
        const entry =
            await createHistoryEntry({
                title,
                description,
                event_date: date
            });

        if (!entry) {
            throw new Error(
                "No se ha podido guardar el momento."
            );
        }

        document.getElementById(
            "historyTitle"
        ).value = "";

        document.getElementById(
            "historyDate"
        ).value = "";

        document.getElementById(
            "historyDescription"
        ).value = "";

        document.getElementById(
            "historyForm"
        ).classList.remove("active");

        await loadHistoryPage();
    } catch (error) {
        alert(
            getSupabaseErrorMessage(
                error,
                "No se ha podido guardar el momento."
            )
        );
    } finally {
        button.disabled = false;
        button.textContent = "Guardar";
    }
}

function setupDeleteButtons() {
    document
        .querySelectorAll(".delete-history")
        .forEach(button => {
            button.addEventListener(
                "click",
                async () => {
                    const confirmed =
                        confirm(
                            "¿Quieres eliminar este momento de la historia?"
                        );

                    if (!confirmed) {
                        return;
                    }

                    button.disabled = true;

                    try {
                        await deleteHistoryEntry(
                            button.dataset.historyId
                        );

                        await loadHistoryPage();
                    } catch (error) {
                        button.disabled = false;

                        alert(
                            getSupabaseErrorMessage(
                                error,
                                "No se ha podido eliminar el momento."
                            )
                        );
                    }
                }
            );
        });
});
