import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class EventCommentsContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.migration = (ROOT / "supabase/migrations/20261012094111_add_event_comments_and_notifications.sql").read_text()
        cls.comments = (ROOT / "js/comments.js").read_text()
        cls.event_page = (ROOT / "js/evento-publico.js").read_text()
        cls.event_html = (ROOT / "evento-publico.html").read_text()
        cls.notifications = (ROOT / "js/notificaciones.js").read_text()
        cls.app = (ROOT / "js/app.js").read_text()
        cls.readme = (ROOT / "README.md").read_text()

    def test_comment_table_has_length_limit_and_indexes(self):
        self.assertIn("CREATE TABLE IF NOT EXISTS public.event_comments", self.migration)
        self.assertIn("BETWEEN 1 AND 500", self.migration)
        self.assertIn("event_comments_event_created_idx", self.migration)

    def test_comment_rls_separates_public_and_group_access(self):
        self.assertIn("TO anon, authenticated", self.migration)
        self.assertIn("e.visibility = 'public'", self.migration)
        self.assertIn("public.group_members", self.migration)
        self.assertIn("user_id = (SELECT auth.uid())", self.migration)
        self.assertIn("Authors and event managers can delete comments", self.migration)

    def test_rate_limit_is_server_side(self):
        self.assertIn("pg_advisory_xact_lock", self.migration)
        self.assertIn("recent_count >= 5", self.migration)
        self.assertIn("NEW.created_at := pg_catalog.now()", self.migration)

    def test_comment_realtime_publication_is_added_without_resetting_it(self):
        self.assertIn("ALTER PUBLICATION supabase_realtime ADD TABLE public.event_comments", self.migration)
        self.assertNotIn("DROP PUBLICATION", self.migration)

    def test_notifications_reuse_existing_schema(self):
        self.assertIn("INSERT INTO public.notifications", self.migration)
        self.assertIn("reference_id", self.migration)
        self.assertIn("'new_comment'", self.migration)
        self.assertIn("'participant_joined'", self.migration)
        self.assertNotIn("CREATE TABLE IF NOT EXISTS public.notifications", self.migration)
        self.assertNotIn("ADD COLUMN IF NOT EXISTS read boolean", self.migration)

    def test_user_content_is_not_injected_as_html(self):
        self.assertIn("createElement('p', 'event-comment-content', escapeText(comment.content))", self.comments)
        self.assertNotIn("innerHTML = comments.map", self.comments)
        self.assertIn("MAX_LENGTH = 500", self.comments)

    def test_comments_are_hooked_up_to_event_detail(self):
        self.assertIn('id="eventCommentsForm"', self.event_page)
        self.assertIn("CommentsModule.init(event, user)", self.event_page)
        self.assertIn('js/comments.js', self.event_html)

    def test_notification_routes_open_the_current_public_event_page(self):
        self.assertIn('"new_comment"', self.notifications)
        self.assertIn('"participant_joined"', self.notifications)
        self.assertIn('"new_comment"', self.app)
        self.assertIn("evento-publico.html?id=", self.app)

    def test_readme_documents_the_active_hosting_and_migration_caveat(self):
        self.assertIn("GitHub Pages", self.readme)
        self.assertIn("Cloudflare", self.readme)
        self.assertIn("no se deben volver a ejecutar", self.readme.lower())


if __name__ == "__main__":
    unittest.main()
