import unittest

from models import CategoryEnum
from main import resolve_search_category


class SearchCategoryTests(unittest.TestCase):
    def test_category_alias_for_analysis(self):
        self.assertEqual(resolve_search_category("Анализы"), CategoryEnum.laboratory)

    def test_category_alias_for_ultrasound(self):
        self.assertEqual(resolve_search_category("УЗИ"), CategoryEnum.diagnostics)


if __name__ == "__main__":
    unittest.main()
