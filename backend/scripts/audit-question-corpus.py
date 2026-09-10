"""Read-only rule 1.2 corpus audit. Does not upload or rewrite source files."""
import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


def audit(root):
    files = sorted(root.rglob('*.md'))
    years, levels, identifiers, identities = Counter(), Counter(), defaultdict(list), defaultdict(list)
    errors, image_count = [], 0
    for path in files:
        relative = path.relative_to(root).as_posix()
        try:
            text = path.read_text(encoding='utf-8-sig')
        except UnicodeError:
            errors.append({'file': relative, 'message': 'Not UTF-8'})
            continue
        header = re.match(r'^\s*---\s*\n(.*?)\n---', text, re.S)
        metadata = {}
        if header:
            for line in header[1].splitlines():
                match = re.match(r'^\s*(\w+)\s*[:：]\s*(.*?)\s*$', line)
                if match:
                    metadata[match[1].lower()] = match[2]
        for name in ['id', 'year', 'source', 'question_type', 'number', 'difficulty', 'tags']:
            if not metadata.get(name):
                errors.append({'file': relative, 'message': f'Missing {name}'})
        years[metadata.get('year', '')] += 1
        levels[metadata.get('difficulty', '')] += 1
        identifiers[metadata.get('id', '')].append(relative)
        number = re.sub(r'^T(?=\d+$)', '', metadata.get('number', ''), flags=re.I)
        identities[(path.parent.relative_to(root).as_posix(), number)].append(relative)
        references = []
        for match in re.finditer(r'^\s*img\s*[:：]\s*(.*)$', text, re.M | re.I):
            value = match[1].strip()
            if value and value != '0':
                references.extend(re.findall(r'\{([^}]+)\}', value) or [value])
        references.extend(re.findall(r'!\[[^]\n]*]\(([^)\n]+)\)', text))
        for name in set(references):
            image_count += 1
            target = (path.parent / name).resolve()
            if not target.is_relative_to(root.resolve()) or not target.is_file():
                errors.append({'file': relative, 'message': f'Missing or external image: {name}'})
    duplicates = {key: values for key, values in identifiers.items() if len(values) > 1}
    return {
        'ruleVersion': '1.2', 'markdownFiles': len(files),
        'paperDirectories': len({path.parent for path in files}),
        'years': dict(sorted(years.items())), 'difficulty': dict(sorted(levels.items())),
        'imageReferences': image_count,
        'duplicateOriginalIdGroups': len(duplicates),
        'filesWithRepeatedOriginalIds': sum(map(len, duplicates.values())),
        'duplicatePaperNumbers': [values for values in identities.values() if len(values) > 1],
        'errors': errors,
        'duplicateOriginalIdExamples': dict(list(duplicates.items())[:10]),
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    if not args.root.is_dir():
        parser.error('root must be an existing directory')
    result = audit(args.root)
    output = json.dumps(result, ensure_ascii=False, indent=2)
    if args.report:
        args.report.write_text(output, encoding='utf-8')
    else:
        print(output)
