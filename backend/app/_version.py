"""Single source of truth for the app's provenance version stamp.

Bumped manually at each milestone of the evidence-workbench rework so
that every RunResponse (and thus every stored run record) says which
build produced its numbers.
"""

APP_VERSION = "0.2.0-provenance-core"
