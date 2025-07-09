#!/usr/bin/env zx

/*
const TITLE = "Vertigo suite";
const inputPdf = "Downloads/Vertigo suite - gammel, Parts.pdf";
const OUTPUT_DIR = "Vertigo parts";
const outputPrefix = "Vertigo_suite_split_page";
const SEARCH_TEXT = "Vertigo suite";
*/

const TITLE = "Symfoni no. 2 Fatum Finale";
// const inputPdf = "/home/martin/Downloads/Symfoni no 2 Fatum Finale - Stemmer/Symfoni no 2 Fatum Finale - Treblås.pdf";
const inputPdf = '/home/martin/Downloads/Symfoni no 2 Fatum Finale - Stemmer/Symfoni no 2 Fatum Finale - Messing og perc.pdf';
const OUTPUT_DIR = "Symfoni no 2 Fatum Finale parts";
const outputPrefix = "Symfoni_no_2_Fatum_Finale_split_page3";
const SEARCH_TEXT = "Symfoni no.2";

const pdfgrepoutput = await $`pdfgrep -no ${SEARCH_TEXT} ${inputPdf}`;
const pageNumbers = pdfgrepoutput
  .lines()
  .map((line) => parseInt(line.split(":")[0], 10)); // Convert to number

// Check if we have any page numbers
if (pageNumbers.length === 0) {
  console.error("No pages found with the specified text.");
  process.exit(1);
}

await $`mkdir -p ${OUTPUT_DIR}`;

// Split the PDF
for (let i = 0; i < pageNumbers.length; i++) {
  let pdfseparate_flags = [];
  const start = pageNumbers[i];
  pdfseparate_flags.push("-f", start);
  const end = pageNumbers[i + 1] - 1 || "";
  if (end) {
    pdfseparate_flags.push("-l", end);
  }

  // Generate output filename
  const outputFile = `${outputPrefix}_${start}_%d.pdf`;

  // Use pdfseparate to extract the pages
  await $`pdfseparate ${pdfseparate_flags} ${inputPdf} ${outputFile}`;
  console.log(`Created: ${outputFile}`);

  // Run pdfunite to merge the pages into a single PDF
  let instrument =
    await $`pdftotext -raw ${outputPrefix}_${start}_${start}.pdf - | grep -A1 Copyright | tail -n1`;
  instrument = instrument.stdout.trim();
  instrument = instrument
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  // glob has wrong sort (eg. 10 is before 2)
  let files = [`${outputPrefix}_${start}_${start}.pdf`];
  for (let j = start + 1; j <= (end || pageNumbers.length); j++) {
    files.push(`${outputPrefix}_${start}_${j}.pdf`);
  }

  // await $`pdfunite ${outputPrefix}_${start}_*.pdf ${OUTPUT_DIR}/${instrument}.pdf`;
    let filename = `${TITLE} ${instrument}`;
  await $`pdfunite ${files} ${OUTPUT_DIR}/${filename}.pdf`;
}

console.log("PDF splitting complete.");
