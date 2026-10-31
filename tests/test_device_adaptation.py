from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class DeviceAdaptationTests(unittest.TestCase):
    def test_device_detection_uses_viewport_and_input_capabilities(self):
        source = (ROOT / "js/i18n.js").read_text(encoding="utf-8")
        for marker in (
            '(pointer: coarse)',
            '(hover: hover)',
            '(max-width: 767px)',
            'dataset.device',
            'dataset.input',
            'device-mobile',
            'device-tablet',
            'device-desktop',
            'orientationchange',
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, source)

    def test_mobile_interaction_styles_are_available(self):
        source = (ROOT / "css/mobile-first-fixes.css").read_text(encoding="utf-8")
        self.assertIn('body.device-mobile', source)
        self.assertIn('@media (pointer:coarse)', source)
        self.assertIn('min-height:42px', source)


if __name__ == "__main__":
    unittest.main()
