#!/usr/bin/env python3

import os
import re
from argparse import ArgumentParser
from openai import OpenAI
import ocrmypdf
from tempfile import NamedTemporaryFile
from pypdf import PdfReader, PdfWriter, PageObject

openai_client = OpenAI()

def ensure_searchable_pdf(input_pdf):
    temp_output = NamedTemporaryFile(delete=True, delete_on_close=False, suffix=".pdf").name
    ocrmypdf.ocr(input_pdf, temp_output, force_ocr=True)
    return temp_output

def extract_text(page: PageObject):
    text = page.extract_text(extraction_mode="layout")
    text = text.strip()
    if not text:
        text = page.extract_text()
    if not text:
        print("⚠️ Warning: Page text extraction failed. Try using OCR?")
    return text

def find_split_pages(input_pdf, search_text):
    pages = []
    with open(input_pdf, "rb") as f:
        reader = PdfReader(f)
        for i, page in enumerate(reader.pages):
            text = extract_text(page)
            if search_text.lower() in text.lower():
                pages.append(i)
    return pages

def identify_instrument(text_snippet):
    prompt = f"""This is a snippet from a sheet music part. It has been thourgh OCR and can contain errors, like «2nd» becomes «and». I want the part name in this example format: «1st Bb Clarinet», «3rd Trombone», «Bass Trombone», «2nd Horn in F». E.g. «Alto Saxophone 1» should become «1st Alto Saxophone» and «Alto Saxophone 2» should become «2nd Alto Saxophone». «Tuba» should become «Tuba». Identify the part it is written for:

{text_snippet}

Respond with only the part name."""


    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )
    result = response.choices[0].message.content.strip()
    return result

def clean_filename(name):
    return re.sub(r'[^a-zA-Z0-9]', '_', name).strip('_')

def split_and_export(pdf_path, split_pages, output_dir, title):
    os.makedirs(output_dir, exist_ok=True)
    with open(pdf_path, "rb") as f:
        reader = PdfReader(f)
        for i in range(len(split_pages)):
            start = split_pages[i]
            end = split_pages[i + 1] if i + 1 < len(split_pages) else len(reader.pages)

            writer = PdfWriter()
            snippet = ""
            for j in range(start, end):
                writer.add_page(reader.pages[j])
                snippet += extract_text(reader.pages[j])

            instrument = identify_instrument(snippet)
            instrument_clean = clean_filename(instrument)
            output_filename = f"{title} {instrument_clean}.pdf"
            output_path = os.path.join(output_dir, output_filename)

            with open(output_path, "wb") as out_pdf:
                writer.write(out_pdf)
            print(f"✅ Exported: {output_path}")

def main():
    parser = ArgumentParser(description="Split a PDF into instrument parts using GPT to label them.")
    parser.add_argument("--input_pdf", help="Path to the input PDF")
    parser.add_argument("--search_text", help="Text to locate start of each part (e.g. title)")
    parser.add_argument("--title", help="Title prefix for output files")
    parser.add_argument("-o", "--output-dir", default="output_parts", help="Directory to store output PDFs")
    parser.add_argument("--ocr", action="store_true", help="Enable OCR preprocessing (if PDF is not searchable)")

    args = parser.parse_args()
    searchable_pdf = args.input_pdf
    if not searchable_pdf:
        parser.print_help()
        raise SystemExit(2)

    if args.ocr:
        print("🔍 Making PDF searchable...")
        searchable_pdf = ensure_searchable_pdf(args.input_pdf)

    print("🔎 Finding page split points...")
    split_pages = find_split_pages(searchable_pdf, args.search_text)
    if not split_pages:
        print("❌ No pages found with the specified search text.")
        return

    print("✂️ Splitting and identifying instruments...")
    split_and_export(searchable_pdf, split_pages, args.output_dir, args.title)

    print("✅ Done.")

if __name__ == "__main__":
    main()
