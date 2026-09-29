import { strict as assert } from "node:assert";
import { test } from "node:test";
import { displayProjectName } from "../lib/project-name";

test("resupply notice wording is removed only from the end of a project name", () => {
  assert.equal(
    displayProjectName("새절역 두산위브 트레지움 불법행위재공급"),
    "새절역 두산위브 트레지움",
  );
  assert.equal(
    displayProjectName(
      "송도국제도시 F20-1블록 더샵 송도프라임뷰(불법행위재공급)",
    ),
    "송도국제도시 F20-1블록 더샵 송도프라임뷰",
  );
  assert.equal(
    displayProjectName("영통 푸르지오 파인베르(A2BL)(불법행위 재공급)"),
    "영통 푸르지오 파인베르(A2BL)",
  );
  assert.equal(
    displayProjectName("불법행위 재공급 단지 안내관"),
    "불법행위 재공급 단지 안내관",
  );
  assert.equal(displayProjectName("불법행위재공급"), "불법행위재공급");
});
