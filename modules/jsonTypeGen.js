/**
 * DevForge - JSON to Types Generator Module
 * Generates TypeScript, Python Pydantic/Dataclasses, Go structs, Rust structs, JSON Schema, and SQL DDL.
 */

function toPascalCase(str) {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[a-z]/, (chr) => chr.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '') || 'Item';
}

function toSnakeCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase();
}

function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function getType(val) {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  return typeof val;
}

export function generateTypes(jsonInput, rootName = 'RootObject', target = 'typescript') {
  let parsed;
  try {
    parsed = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
  } catch (err) {
    throw new Error('Invalid JSON input: ' + err.message);
  }

  const rootCapital = toPascalCase(rootName);

  switch (target) {
    case 'typescript':
      return generateTypeScript(parsed, rootCapital);
    case 'python-pydantic':
      return generatePydantic(parsed, rootCapital);
    case 'python-dataclass':
      return generatePythonDataclass(parsed, rootCapital);
    case 'go':
      return generateGo(parsed, rootCapital);
    case 'rust':
      return generateRust(parsed, rootCapital);
    case 'json-schema':
      return generateJsonSchema(parsed);
    case 'sql-ddl':
      return generateSqlDdl(parsed, rootCapital);
    default:
      throw new Error(`Unsupported target: ${target}`);
  }
}

// ---------------- TypeScript Generator ----------------
function generateTypeScript(data, rootName) {
  const interfaces = [];
  const visited = new Set();

  function parseObject(obj, name) {
    if (visited.has(name)) return name;
    visited.add(name);

    if (Array.isArray(obj)) {
      if (obj.length === 0) return 'any[]';
      const elemType = parseType(obj[0], `${name}Item`);
      return `${elemType}[]`;
    }

    if (typeof obj !== 'object' || obj === null) {
      return parseType(obj, name);
    }

    const lines = [`export interface ${name} {`];
    for (const [key, value] of Object.entries(obj)) {
      const fieldType = parseType(value, `${name}_${toPascalCase(key)}`);
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
      lines.push(`  ${safeKey}: ${fieldType};`);
    }
    lines.push('}');
    interfaces.unshift(lines.join('\n'));
    return name;
  }

  function parseType(val, fieldNameHint) {
    const type = getType(val);
    if (type === 'string') return 'string';
    if (type === 'number') return 'number';
    if (type === 'boolean') return 'boolean';
    if (type === 'null') return 'any | null';
    if (type === 'array') {
      if (val.length === 0) return 'any[]';
      return `${parseType(val[0], fieldNameHint)}[]`;
    }
    if (type === 'object') {
      return parseObject(val, toPascalCase(fieldNameHint));
    }
    return 'any';
  }

  parseObject(data, rootName);
  return interfaces.join('\n\n');
}

// ---------------- Python Pydantic V2 Generator ----------------
function generatePydantic(data, rootName) {
  const models = [];
  const visited = new Set();

  function parseObject(obj, name) {
    if (visited.has(name)) return name;
    visited.add(name);

    if (Array.isArray(obj)) {
      if (obj.length === 0) return 'List[Any]';
      const itemType = parseType(obj[0], `${name}Item`);
      return `List[${itemType}]`;
    }

    if (typeof obj !== 'object' || obj === null) {
      return parseType(obj, name);
    }

    const lines = [`class ${name}(BaseModel):`];
    const entries = Object.entries(obj);
    if (entries.length === 0) {
      lines.push('    pass');
    } else {
      for (const [key, value] of entries) {
        const fieldType = parseType(value, `${name}${toPascalCase(key)}`);
        const pyKey = toSnakeCase(key);
        if (pyKey !== key) {
          lines.push(`    ${pyKey}: ${fieldType} = Field(..., alias="${key}")`);
        } else {
          lines.push(`    ${pyKey}: ${fieldType}`);
        }
      }
    }

    models.unshift(lines.join('\n'));
    return name;
  }

  function parseType(val, nameHint) {
    const type = getType(val);
    if (type === 'string') return 'str';
    if (type === 'number') return Number.isInteger(val) ? 'int' : 'float';
    if (type === 'boolean') return 'bool';
    if (type === 'null') return 'Optional[Any]';
    if (type === 'array') {
      if (val.length === 0) return 'List[Any]';
      return `List[${parseType(val[0], nameHint)}]`;
    }
    if (type === 'object') {
      return parseObject(val, toPascalCase(nameHint));
    }
    return 'Any';
  }

  parseObject(data, rootName);
  return `from typing import List, Optional, Any, Dict\nfrom pydantic import BaseModel, Field\n\n\n${models.join('\n\n')}`;
}

// ---------------- Python Dataclass Generator ----------------
function generatePythonDataclass(data, rootName) {
  const classes = [];
  const visited = new Set();

  function parseObject(obj, name) {
    if (visited.has(name)) return name;
    visited.add(name);

    if (Array.isArray(obj)) {
      if (obj.length === 0) return 'List[Any]';
      return `List[${parseType(obj[0], `${name}Item`)}]`;
    }
    if (typeof obj !== 'object' || obj === null) {
      return parseType(obj, name);
    }

    const lines = ['@dataclass', `class ${name}:`];
    const entries = Object.entries(obj);
    if (entries.length === 0) {
      lines.push('    pass');
    } else {
      for (const [key, value] of entries) {
        const fieldType = parseType(value, `${name}${toPascalCase(key)}`);
        lines.push(`    ${toSnakeCase(key)}: ${fieldType}`);
      }
    }
    classes.unshift(lines.join('\n'));
    return name;
  }

  function parseType(val, nameHint) {
    const type = getType(val);
    if (type === 'string') return 'str';
    if (type === 'number') return Number.isInteger(val) ? 'int' : 'float';
    if (type === 'boolean') return 'bool';
    if (type === 'null') return 'Optional[Any]';
    if (type === 'array') {
      if (val.length === 0) return 'List[Any]';
      return `List[${parseType(val[0], nameHint)}]`;
    }
    if (type === 'object') {
      return parseObject(val, toPascalCase(nameHint));
    }
    return 'Any';
  }

  parseObject(data, rootName);
  return `from dataclasses import dataclass\nfrom typing import List, Optional, Any, Dict\n\n\n${classes.join('\n\n')}`;
}

// ---------------- Go Struct Generator ----------------
function generateGo(data, rootName) {
  const structs = [];
  const visited = new Set();

  function parseObject(obj, name) {
    if (visited.has(name)) return name;
    visited.add(name);

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]any';
      return `[]${parseType(obj[0], `${name}Item`)}`;
    }
    if (typeof obj !== 'object' || obj === null) {
      return parseType(obj, name);
    }

    const lines = [`type ${name} struct {`];
    for (const [key, value] of Object.entries(obj)) {
      const goField = toPascalCase(key);
      const fieldType = parseType(value, `${name}${goField}`);
      lines.push(`\t${goField} ${fieldType} \`json:"${key}"\``);
    }
    lines.push('}');
    structs.unshift(lines.join('\n'));
    return name;
  }

  function parseType(val, nameHint) {
    const type = getType(val);
    if (type === 'string') return 'string';
    if (type === 'number') return Number.isInteger(val) ? 'int64' : 'float64';
    if (type === 'boolean') return 'bool';
    if (type === 'null') return '*any';
    if (type === 'array') {
      if (val.length === 0) return '[]any';
      return `[]${parseType(val[0], nameHint)}`;
    }
    if (type === 'object') {
      return parseObject(val, toPascalCase(nameHint));
    }
    return 'any';
  }

  parseObject(data, rootName);
  return `package models\n\n${structs.join('\n\n')}`;
}

// ---------------- Rust Struct Generator ----------------
function generateRust(data, rootName) {
  const structs = [];
  const visited = new Set();

  function parseObject(obj, name) {
    if (visited.has(name)) return name;
    visited.add(name);

    if (Array.isArray(obj)) {
      if (obj.length === 0) return 'Vec<serde_json::Value>';
      return `Vec<${parseType(obj[0], `${name}Item`)}>`;
    }
    if (typeof obj !== 'object' || obj === null) {
      return parseType(obj, name);
    }

    const lines = [
      '#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]',
      `pub struct ${name} {`
    ];

    for (const [key, value] of Object.entries(obj)) {
      const rustField = toSnakeCase(key);
      const fieldType = parseType(value, `${name}${toPascalCase(key)}`);
      if (rustField !== key) {
        lines.push(`    #[serde(rename = "${key}")]`);
      }
      lines.push(`    pub ${rustField}: ${fieldType},`);
    }
    lines.push('}');
    structs.unshift(lines.join('\n'));
    return name;
  }

  function parseType(val, nameHint) {
    const type = getType(val);
    if (type === 'string') return 'String';
    if (type === 'number') return Number.isInteger(val) ? 'i64' : 'f64';
    if (type === 'boolean') return 'bool';
    if (type === 'null') return 'Option<serde_json::Value>';
    if (type === 'array') {
      if (val.length === 0) return 'Vec<serde_json::Value>';
      return `Vec<${parseType(val[0], nameHint)}>`;
    }
    if (type === 'object') {
      return parseObject(val, toPascalCase(nameHint));
    }
    return 'serde_json::Value';
  }

  parseObject(data, rootName);
  return `use serde::{Deserialize, Serialize};\n\n${structs.join('\n\n')}`;
}

// ---------------- JSON Schema Generator ----------------
function generateJsonSchema(data) {
  function parseVal(val) {
    const type = getType(val);
    if (type === 'string') return { type: 'string' };
    if (type === 'number') return { type: Number.isInteger(val) ? 'integer' : 'number' };
    if (type === 'boolean') return { type: 'boolean' };
    if (type === 'null') return { type: 'null' };
    if (type === 'array') {
      return {
        type: 'array',
        items: val.length > 0 ? parseVal(val[0]) : {}
      };
    }
    if (type === 'object') {
      const properties = {};
      const required = [];
      for (const [k, v] of Object.entries(val)) {
        properties[k] = parseVal(v);
        required.push(k);
      }
      return {
        type: 'object',
        properties,
        required
      };
    }
    return {};
  }

  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'GeneratedSchema',
    ...parseVal(data)
  };

  return JSON.stringify(schema, null, 2);
}

// ---------------- SQL DDL Generator ----------------
function generateSqlDdl(data, tableName) {
  const obj = Array.isArray(data) ? (data[0] || {}) : data;
  if (typeof obj !== 'object' || obj === null) {
    return `-- Cannot generate SQL table for non-object JSON`;
  }

  const tName = toSnakeCase(tableName);
  const cols = [`    id BIGSERIAL PRIMARY KEY`];

  for (const [key, value] of Object.entries(obj)) {
    const colName = toSnakeCase(key);
    const type = getType(value);
    let sqlType = 'VARCHAR(255)';

    if (type === 'number') {
      sqlType = Number.isInteger(value) ? 'BIGINT' : 'NUMERIC(12, 4)';
    } else if (type === 'boolean') {
      sqlType = 'BOOLEAN';
    } else if (type === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        sqlType = 'TIMESTAMPTZ';
      } else if (value.length > 255) {
        sqlType = 'TEXT';
      } else {
        sqlType = 'VARCHAR(255)';
      }
    } else if (type === 'object' || type === 'array') {
      sqlType = 'JSONB';
    }

    cols.push(`    ${colName} ${sqlType}`);
  }

  cols.push(`    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

  return `CREATE TABLE IF NOT EXISTS ${tName} (\n${cols.join(',\n')}\n);`;
}
