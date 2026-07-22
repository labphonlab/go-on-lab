import sys
from pathlib import Path

# pipeline.py and the analysis/ package assume "linguaforge/" itself is on
# sys.path (true when it's run as `python pipeline.py`); pytest needs the
# same thing spelled out explicitly.
sys.path.insert(0, str(Path(__file__).parent))
