#!/usr/bin/env python3
"""Validate a legacy export and create an offline BeautyDocs dry-run report."""

from __future__ import annotations

import argparse
from pathlib import Path
from uuid import UUID

from app.migration_tools.legacy_powderbrows import (
    build_migration_plan,
    load_legacy_export,
    write_private_json,
)


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Plan PowderBrows migration without connecting to a target database"
    )
    parser.add_argument("--input", type=Path, required=True, help="Versioned legacy JSON")
    parser.add_argument(
        "--tenant-id",
        type=UUID,
        required=True,
        help="Pre-allocated BeautyDocs PowderBrows tenant UUID",
    )
    parser.add_argument(
        "--owner-admin-legacy-id",
        required=True,
        help="Explicit legacy AdminUser.id that will receive the OWNER membership",
    )
    parser.add_argument(
        "--report",
        type=Path,
        required=True,
        help="New confidential report path without direct PII fields",
    )
    parser.add_argument(
        "--plan-output",
        type=Path,
        help="Optional sensitive normalized plan; created with mode 0600",
    )
    return parser.parse_args()


def main() -> int:
    arguments = _arguments()
    for output_path in (arguments.report, arguments.plan_output):
        if output_path is not None and output_path.exists():
            raise SystemExit(f"Output path already exists: {output_path}")

    legacy_export = load_legacy_export(arguments.input)
    result = build_migration_plan(
        legacy_export,
        arguments.tenant_id,
        owner_admin_legacy_id=arguments.owner_admin_legacy_id,
    )
    write_private_json(
        arguments.report,
        result.report.model_dump(mode="json", by_alias=True),
    )
    if arguments.plan_output is not None:
        write_private_json(
            arguments.plan_output,
            result.plan.model_dump(mode="json", by_alias=True),
        )

    print(
        "Dry-run complete: "
        f"errors={len(result.report.errors)}, "
        f"warnings={len(result.report.warnings)}, "
        f"unsupported={len(result.report.unsupported)}"
    )
    return 2 if result.report.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
