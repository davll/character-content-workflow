import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '../../..');
const illustrationSkillPath = path.join(workspaceRoot, 'skills', 'illustration-generation', 'SKILL.md');

test('illustration-generation documents object resolution before prompt building', async () => {
  const skill = await fs.readFile(illustrationSkillPath, 'utf8');

  assert.match(skill, /Use the `object-registry` skill/);
  assert.match(skill, /### Stage 3: Object Resolution/);
  assert.match(skill, /This stage runs after character sheet selection and before scene\/reference planning\./);
  assert.match(skill, /use `examples\/objects\/index.yaml` when it exists/);
  assert.match(skill, /development fixture fallback only/);
  assert.match(skill, /`holding`, `walking with`, `carrying`, `拿著` -> `carrying`/);
});

test('illustration-generation documents canonical character-object-external reference ordering', async () => {
  const skill = await fs.readFile(illustrationSkillPath, 'utf8');

  assert.match(skill, /1\. Registry character or group sheets first/);
  assert.match(skill, /2\. Object registry reference images next/);
  assert.match(skill, /3\. External references next/);
  assert.match(skill, /Object registry reference: `<Nth> image: ONLY for <target object>'s object design/);
});

test('illustration-generation documents reference handoff validation for object references', async () => {
  const skill = await fs.readFile(illustrationSkillPath, 'utf8');

  assert.match(skill, /Every selected object reference must resolve through `get-reference-path`/);
  assert.match(skill, /No object reference path is passed to `image-generation` unless it resolved through `object-registry get-reference-path`/);
});
