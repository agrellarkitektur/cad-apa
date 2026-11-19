// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
/// <reference lib="webworker" />
import { registerBuiltInTypes } from '../elements';
import { handleSectionJob, type SectionJob } from './sectionJob';

/**
 * Bakgrundstråden för fasader och sektioner (0.8.2). Den får projektet (utan
 * underlagens filer), räknar fram vyn med samma kod som förut och skickar
 * tillbaka resultatet. Se `src/ui/app/sectionQueue.ts`.
 */
registerBuiltInTypes();

self.onmessage = (e: MessageEvent<SectionJob>) => {
  self.postMessage(handleSectionJob(e.data));
};
