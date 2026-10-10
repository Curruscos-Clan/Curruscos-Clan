import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
HOME = (ROOT / "index.html").read_text(encoding="utf-8")


class HomeFeedEventFilterTests(unittest.TestCase):
    def test_filter_runs_after_recommendation_fallback_branch(self):
        fallback = HOME.index('if (!events.length)')
        fallback_end = HOME.index('\n  }', fallback)
        filter_start = HOME.index('events = events.filter(event => {', fallback)
        render_start = HOME.index('rec.innerHTML = events.slice(0, 5).map', filter_start)
        self.assertLess(fallback_end, filter_start)
        self.assertLess(filter_start, render_start)

    def test_filter_supports_both_event_date_shapes(self):
        self.assertIn('const date = event.date || event.event_date;', HOME)
        self.assertIn('const time = event.time || event.event_time || "23:59";', HOME)

    def test_live_events_are_preserved_and_invalid_or_undated_events_removed(self):
        self.assertIn('if (event.status === "live") return true;', HOME)
        self.assertIn('if (!date) return false;', HOME)
        self.assertIn('Number.isFinite(timestamp) && timestamp >= now.getTime()', HOME)


if __name__ == "__main__":
    unittest.main()
