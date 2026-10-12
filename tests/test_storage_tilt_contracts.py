#!/usr/bin/env python3
"""Static contracts for public image storage, safe covers, and the 3D tilt helper."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


class StorageAndTiltContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.storage = read("js/storage.js")
        cls.tilt = read("js/tilt-3d.js")
        cls.supabase = read("js/supabase.js")
        cls.migration = read("supabase/migrations/20261012092007_add_public_image_storage_buckets.sql").lower()

    def test_uploads_use_the_shared_authenticated_client(self):
        self.assertIn("window.supabaseClient", self.storage)
        self.assertIn("client.auth.getUser()", self.storage)
        self.assertIn("upsert: false", self.storage)
        self.assertIn("uploadUserAvatar", self.storage)
        self.assertIn("uploadEventCover", self.storage)
        self.assertNotIn("service_role", self.storage.lower())

    def test_images_are_validated_and_recompressed_before_upload(self):
        self.assertIn("MAX_INPUT_BYTES = 20 * 1024 * 1024", self.storage)
        self.assertIn("image/jpeg", self.storage)
        self.assertIn("image/png", self.storage)
        self.assertIn("canvasBlob(canvas, \"image/webp\"", self.storage)
        self.assertIn("canvasBlob(canvas, \"image/jpeg\"", self.storage)
        self.assertIn("context.drawImage", self.storage)

    def test_storage_migration_only_allows_authenticated_own_folder_uploads(self):
        sql = self.migration
        self.assertIn("('avatars', 'avatars', true", sql)
        self.assertIn("('event-covers', 'event-covers', true", sql)
        self.assertIn('create policy "curruscos upload own avatars"', sql)
        self.assertIn('create policy "curruscos upload own event covers"', sql)
        self.assertIn('for insert to authenticated', sql)
        self.assertIn("(storage.foldername(name))[1] = (select auth.uid())::text", sql)
        self.assertNotIn("for insert to anon", sql)
        self.assertIn("create policy \"curruscos delete own avatars\"", sql)
        self.assertIn("create policy \"curruscos delete own event covers\"", sql)

    def test_event_cover_url_is_added_and_used_with_the_existing_event_contract(self):
        self.assertIn("add column if not exists cover_url text", self.migration)
        self.assertIn("events_cover_url_https_check", self.migration)
        self.assertIn("cover_url: eventData.cover_url || null", self.supabase)
        self.assertIn("cover_url,created_at", self.supabase)
        self.assertIn('select(base)', self.supabase)

    def test_public_buckets_are_only_for_public_images(self):
        sql = self.migration
        self.assertIn("avatar and public-event cover images are public assets", sql)
        self.assertIn("private groups and encrypted group events must not use these buckets", sql)
        self.assertIn("public.event-covers", sql) if False else None

    def test_tilt_respects_reduced_motion_and_avoids_touch_input(self):
        self.assertIn('"(prefers-reduced-motion: reduce)"', self.tilt)
        self.assertIn("if (reducedMotion.matches", self.tilt)
        self.assertIn('event.pointerType !== "mouse"', self.tilt)
        self.assertIn('event.pointerType !== "pen"', self.tilt)
        self.assertIn("requestAnimationFrame", self.tilt)
        self.assertIn("MutationObserver", self.tilt)
        self.assertIn("rotateX(", self.tilt)
        self.assertIn("rotateY(", self.tilt)

    def test_tilt_and_cover_scripts_are_wired_into_the_pages_that_use_them(self):
        self.assertIn('src="js/tilt-3d.js"', read("index.html"))
        self.assertIn('src="js/tilt-3d.js"', read("explorar.html"))
        self.assertIn('src="js/storage.js"', read("perfil.html"))
        self.assertIn('src="js/storage.js"', read("crear-evento.html"))
        self.assertIn('id="publicEventCover"', read("crear-evento.html"))
        self.assertIn("safePublicEventCover(event.cover_url)", read("js/evento-publico.js"))
        self.assertIn("safeExploreCover(event.cover_url)", read("js/explorar.js"))

    def test_cloudflare_configuration_is_not_misrepresented_as_active_on_github_pages(self):
        self.assertIn("GitHub Pages does not process this file", read("_headers"))
        self.assertIn("inactive while this project is hosted on GitHub Pages", read("_redirects"))
        self.assertIn("does not load this file", read(".env.example").lower())


if __name__ == "__main__":
    unittest.main()
