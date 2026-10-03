/* =========================================================
   CURRUSCOS — RECUERDOS
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    await window.curruscosI18n?.ready;
    const access = await window.curruscosReady;

    if (!access) {
        return;
    }

    await loadMemoriesPage();
    setupMemoryForm();
});

async function loadMemoriesPage() {
    const grid =
        document.getElementById("memoriesGrid");

    grid.innerHTML =
        "<p>Cargando recuerdos...</p>";

    const memories =
        await getGroupMemories();

    if (!memories.length) {
        grid.innerHTML = `
            <div class="empty-memories">
                <h2>Aún no hay recuerdos</h2>
                <p>
                    Cread el primero y empezad a construir
                    la historia del grupo.
                </p>
            </div>
        `;
        return;
    }

    grid.innerHTML = "";

    memories.forEach(memory => {
        const card =
            document.createElement("article");

        card.className =
            "memory-card";

        const profile =
            memory.profiles;

        const creator =
            profile?.display_name ||
            profile?.username ||
            "Miembro del grupo";

        if (memory.image_url) {
            const image =
                document.createElement("img");

            image.src =
                memory.image_url;

            image.className =
                "memory-image";

            image.alt =
                memory.title || "Recuerdo";

            image.loading =
                "lazy";

            image.referrerPolicy =
                "no-referrer";

            image.addEventListener(
                "error",
                () => {
                    image.remove();
                },
                { once: true }
            );

            card.appendChild(image);
        }

        const content =
            document.createElement("div");

        content.className =
            "memory-content";

        const title =
            document.createElement("h3");

        title.textContent =
            memory.title || "Recuerdo";

        content.appendChild(title);

        if (memory.description) {
            const description =
                document.createElement("p");

            description.className =
                "memory-description";

            description.textContent =
                memory.description;

            content.appendChild(
                description
            );
        }

        const meta =
            document.createElement("div");

        meta.className =
            "memory-meta";

        meta.textContent =
            "Publicado por " + creator;

        content.appendChild(meta);

        const canDelete =
            window.curruscosCurrentAccess?.currentGroup?.role === "owner" ||
            window.curruscosCurrentAccess?.currentGroup?.role === "admin" ||
            memory.created_by ===
                window.curruscosCurrentAccess?.user?.id;

        if (canDelete) {
            const remove =
                document.createElement("button");

            remove.type =
                "button";

            remove.className =
                "delete-memory";

            remove.dataset.memoryId =
                memory.id;

            remove.textContent =
                "Eliminar";

            content.appendChild(remove);
        }

        card.appendChild(content);
        grid.appendChild(card);
    });

    setupDeleteButtons();
}

function setupMemoryForm() {
    const newButton =
        document.getElementById(
            "newMemoryButton"
        );

    const form =
        document.getElementById(
            "memoryForm"
        );

    const cancelButton =
        document.getElementById(
            "cancelMemoryButton"
        );

    const saveButton =
        document.getElementById(
            "saveMemoryButton"
        );

    if (!newButton || !form || !cancelButton || !saveButton) {
        return;
    }

    newButton.addEventListener(
        "click",
        () => {
            form.classList.add("active");

            document.getElementById(
                "memoryTitle"
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
        saveMemory
    );
}

async function saveMemory() {
    const title =
        document.getElementById(
            "memoryTitle"
        ).value.trim();

    const description =
        document.getElementById(
            "memoryDescription"
        ).value.trim();

    const imageUrl =
        document.getElementById(
            "memoryImage"
        ).value.trim();

    if (!title) {
        alert(
            "El título del recuerdo es obligatorio."
        );
        return;
    }

    if (
        imageUrl &&
        !/^https?:\/\//i.test(imageUrl)
    ) {
        alert(
            "La imagen debe ser una URL http o https."
        );
        return;
    }

    const button =
        document.getElementById(
            "saveMemoryButton"
        );

    button.disabled = true;
    button.textContent =
        "Guardando recuerdo...";

    try {
        const memory =
            await createGroupMemory({
                title,
                description,
                image_url: imageUrl
            });

        if (!memory) {
            throw new Error(
                "No se ha podido guardar el recuerdo."
            );
        }

        document.getElementById(
            "memoryTitle"
        ).value = "";

        document.getElementById(
            "memoryDescription"
        ).value = "";

        document.getElementById(
            "memoryImage"
        ).value = "";

        document.getElementById(
            "memoryForm"
        ).classList.remove("active");

        await loadMemoriesPage();
    } catch (error) {
        alert(
            getSupabaseErrorMessage(
                error,
                "No se ha podido guardar el recuerdo."
            )
        );
    } finally {
        button.disabled = false;
        button.textContent =
            "Guardar recuerdo";
    }
}

function setupDeleteButtons() {
    document
        .querySelectorAll(".delete-memory")
        .forEach(button => {
            button.addEventListener(
                "click",
                async () => {
                    const confirmed =
                        confirm(
                            "¿Quieres eliminar este recuerdo?"
                        );

                    if (!confirmed) {
                        return;
                    }

                    button.disabled = true;

                    try {
                        await deleteGroupMemory(
                            button.dataset.memoryId
                        );

                        await loadMemoriesPage();
                    } catch (error) {
                        button.disabled = false;

                        alert(
                            getSupabaseErrorMessage(
                                error,
                                "No se ha podido eliminar el recuerdo."
                            )
                        );
                    }
                }
            );
        });
}
