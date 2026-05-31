import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from corpus.audio.synth import write_segmented_wav
from corpus.acquisition.registry import AcquisitionRegistry
from corpus.acquisition.adapters.local_dir import LocalDirectorySource
from corpus.models import License


def _raw_dir_with(n_distinct=2, add_duplicate=False):
    d = tempfile.mkdtemp()
    write_segmented_wav(os.path.join(d, "a.wav"),
                        regions=[(1.0, 1.0), (1.4, 0.8)], gap_s=0.4)
    if n_distinct >= 2:
        write_segmented_wav(os.path.join(d, "b.wav"),
                            regions=[(0.8, 1.2), (1.1, 0.9)], gap_s=0.4, seed=3)
    if add_duplicate:
        import shutil
        shutil.copy2(os.path.join(d, "a.wav"), os.path.join(d, "a_copy.wav"))
    return d


def test_local_catalog_lists_wavs_and_reads_sidecar_text():
    d = _raw_dir_with(n_distinct=1)
    with open(os.path.join(d, "a.txt"), "w", encoding="utf-8") as fh:
        fh.write("hello world")
    items = list(LocalDirectorySource(d, language="en").catalog())
    assert len(items) == 1
    assert items[0].language == "en"
    assert items[0].transcript == "hello world"


def test_acquire_copies_and_records_provenance():
    d = _raw_dir_with(n_distinct=2)
    store = tempfile.mkdtemp()
    reg = AcquisitionRegistry(store)
    got = reg.acquire_from(LocalDirectorySource(d, language="ja"))
    assert len(got) == 2
    for a in got:
        assert os.path.exists(a.local_path)
        assert a.source == "local_dir"
        assert a.license == "CC0-1.0"
        assert len(a.sha256) == 64
        assert a.acquired_at is not None
    # manifest written and parseable
    lines = open(reg.manifest_path, encoding="utf-8").read().strip().splitlines()
    assert len(lines) == 2
    assert all(json.loads(l)["sha256"] for l in lines)


def test_dedup_skips_identical_content():
    d = _raw_dir_with(n_distinct=2, add_duplicate=True)  # 3 files, 2 distinct
    store = tempfile.mkdtemp()
    reg = AcquisitionRegistry(store)
    got = reg.acquire_from(LocalDirectorySource(d))
    assert len(got) == 2, "exact duplicate should be skipped by content hash"


def test_registry_is_idempotent_across_runs():
    d = _raw_dir_with(n_distinct=2)
    store = tempfile.mkdtemp()
    AcquisitionRegistry(store).acquire_from(LocalDirectorySource(d))
    # second run on a fresh registry over the same store acquires nothing new
    reg2 = AcquisitionRegistry(store)
    got = reg2.acquire_from(LocalDirectorySource(d))
    assert got == []
    assert len(reg2.items) == 2


def test_license_summary_counts():
    d = _raw_dir_with(n_distinct=2)
    store = tempfile.mkdtemp()
    reg = AcquisitionRegistry(store)
    reg.acquire_from(LocalDirectorySource(d, license=License.CC0_1_0))
    assert reg.license_summary() == {"CC0-1.0": 2}


def test_acquire_then_annotate_end_to_end():
    from corpus.annotation.orchestrator import AnnotationPipeline
    d = _raw_dir_with(n_distinct=2)
    store = tempfile.mkdtemp()
    reg = AcquisitionRegistry(store)
    acquired = reg.acquire_from(LocalDirectorySource(d, language="ja"))
    pipe = AnnotationPipeline()
    segs = []
    for a in acquired:
        segs.extend(pipe.annotate_file(a.local_path, source_id=a.item_id,
                                       declared_language=a.language))
    assert len(segs) >= 2
    assert all(s.source_id for s in segs)
