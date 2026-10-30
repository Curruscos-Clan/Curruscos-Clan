import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
HOME = (ROOT / "index.html").read_text(encoding="utf-8")
FEED = (ROOT / "js" / "feed.js").read_text(encoding="utf-8")
RECOMMENDATIONS = (ROOT / "js" / "recommendations.js").read_text(encoding="utf-8")
EXPLORE = (ROOT / "js" / "explorar.js").read_text(encoding="utf-8")


class HomeFeedEventFilterTests(unittest.TestCase):
    def test_home_loads_supabase_helpers_before_feed(self):
        supabase = HOME.index('src="js/supabase.js"')
        recommendations = HOME.index('src="js/recommendations.js"')
        feed = HOME.index('src="js/feed.js"')
        self.assertLess(supabase, recommendations)
        self.assertLess(recommendations, feed)

    def test_home_uses_one_coherent_light_theme_without_hidden_webgl_runtime(self):
        self.assertIn('css/home-redesign.css', HOME)
        self.assertNotIn('css/home-dark-bento.css', HOME)
        self.assertNotIn('three.min.js', HOME)
        self.assertNotIn('js/webgl-scene.js', HOME)
        self.assertIn('theme-color" content="#f6f6f3"', HOME)

    def test_home_filter_supports_both_event_date_shapes(self):
        self.assertIn("event?.date||event?.event_date", FEED)
        self.assertIn("event?.time||event?.event_time", FEED)
        self.assertIn(':"T00:00:00"', FEED)

    def test_live_events_are_preserved_and_invalid_or_undated_events_removed(self):
        self.assertIn('if(event.status==="live")return true;', FEED)
        self.assertIn("if(!date||date<=now)return false;", FEED)
        self.assertIn('status!=="live" && (!eventDate || eventDate<=now)', RECOMMENDATIONS)

    def test_recommendations_ignore_cancelled_and_finished_events(self):
        self.assertIn('"cancelled","finished","draft"', RECOMMENDATIONS)
        self.assertIn("function rankEvents(events,userContext={})", RECOMMENDATIONS)

    def test_explore_supports_both_event_date_shapes(self):
        self.assertIn('const date=event.date||event.event_date;', EXPLORE)
        self.assertIn('const time=event.time||event.event_time||"23:59";', EXPLORE)
        self.assertIn('const time=event.time||event.event_time||"00:00";', EXPLORE)

    def test_explore_supports_both_participant_count_shapes(self):
        self.assertIn('event.participant_count??event.event_participants?.[0]?.count??0', EXPLORE)


if __name__ == "__main__":
    unittest.main()
