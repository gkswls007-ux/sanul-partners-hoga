from pathlib import Path

from refresh_local_region_data import refresh_region


SOURCE = Path(r"C:\Users\gkswl\OneDrive\바탕 화면\호가 및 실거래가_고운동.xlsx")
OUTPUT = Path(__file__).parent / "data" / "listings-goun.json"


def main():
    refresh_region("고운동", SOURCE, OUTPUT)


if __name__ == "__main__":
    main()
