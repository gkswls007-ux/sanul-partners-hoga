from pathlib import Path

from refresh_local_region_data import refresh_region


SOURCE = Path(r"C:\Users\gkswl\OneDrive\바탕 화면\호가 및 실거래가_한솔동.xlsx")
OUTPUT = Path(__file__).parent / "data" / "listings-hansol.json"


def main():
    refresh_region("한솔동", SOURCE, OUTPUT)


if __name__ == "__main__":
    main()
