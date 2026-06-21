#!/usr/bin/env -S node --experimental-strip-types
import { main } from './cli.ts';
import { loadDotEnv } from './env.ts';

loadDotEnv();
void main();
