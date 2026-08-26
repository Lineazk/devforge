/**
 * DevForge - cURL Converter Module
 * Parses cURL commands into structured requests and generates code across 11 target languages.
 */

export function parseCurl(curlString) {
  if (!curlString || typeof curlString !== 'string') {
    throw new Error('Please provide a valid cURL command.');
  }

  const cleanCmd = curlString
    .replace(/\\\r?\n/g, ' ') // join escaped multiline
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanCmd.startsWith('curl')) {
    throw new Error('Command must start with "curl".');
  }

  // Tokenization that respects single and double quotes
  const tokens = [];
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  let match;
  while ((match = regex.exec(cleanCmd)) !== null) {
    if (match[1] !== undefined) {
      tokens.push(match[1]);
    } else if (match[2] !== undefined) {
      tokens.push(match[2]);
    } else {
      tokens.push(match[0]);
    }
  }

  const result = {
    method: 'GET',
    url: '',
    headers: {},
    cookies: {},
    auth: null,
    body: null,
    isJson: false,
  };

  let i = 1; // skip 'curl'
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '-X' || token === '--request') {
      result.method = (tokens[++i] || 'GET').toUpperCase();
    } else if (token === '-H' || token === '--header') {
      const headerStr = tokens[++i] || '';
      const colonIdx = headerStr.indexOf(':');
      if (colonIdx > -1) {
        const key = headerStr.slice(0, colonIdx).trim();
        const value = headerStr.slice(colonIdx + 1).trim();
        result.headers[key] = value;
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      result.body = tokens[++i] || '';
      if (result.method === 'GET') {
        result.method = 'POST';
      }
    } else if (token === '-u' || token === '--user') {
      const authStr = tokens[++i] || '';
      const [user, ...pwdParts] = authStr.split(':');
      result.auth = { user, pass: pwdParts.join(':') };
    } else if (token === '-b' || token === '--cookie') {
      const cookieStr = tokens[++i] || '';
      result.headers['Cookie'] = cookieStr;
    } else if (token === '-A' || token === '--user-agent') {
      result.headers['User-Agent'] = tokens[++i] || '';
    } else if (token.startsWith('http://') || token.startsWith('https://') || (!token.startsWith('-') && !result.url)) {
      result.url = token;
    }
    i++;
  }

  // Check if body is valid JSON
  if (result.body) {
    try {
      JSON.parse(result.body);
      result.isJson = true;
    } catch {
      result.isJson = false;
    }
  }

  return result;
}

export function generateCode(parsed, language = 'javascript-fetch') {
  const { method, url, headers, body, auth, isJson } = parsed;

  const headerEntries = Object.entries(headers);
  if (auth && !headers['Authorization']) {
    const basic = btoa(`${auth.user}:${auth.pass}`);
    headerEntries.push(['Authorization', `Basic ${basic}`]);
  }

  switch (language) {
    case 'javascript-fetch': {
      let code = `const url = '${url}';\n`;
      const options = [];
      if (method !== 'GET') options.push(`  method: '${method}'`);
      if (headerEntries.length > 0) {
        const hObj = headerEntries.map(([k, v]) => `    '${k}': '${v}'`).join(',\n');
        options.push(`  headers: {\n${hObj}\n  }`);
      }
      if (body) {
        if (isJson) {
          try {
            const formatted = JSON.stringify(JSON.parse(body), null, 2).split('\n').map(l => '  ' + l).join('\n').trim();
            options.push(`  body: JSON.stringify(${formatted})`);
          } catch {
            options.push(`  body: '${body.replace(/'/g, "\\'")}'`);
          }
        } else {
          options.push(`  body: '${body.replace(/'/g, "\\'")}'`);
        }
      }

      if (options.length > 0) {
        code += `const options = {\n${options.join(',\n')}\n};\n\n`;
        code += `try {\n  const response = await fetch(url, options);\n  const data = await response.json();\n  console.log(data);\n} catch (error) {\n  console.error('Fetch error:', error);\n}`;
      } else {
        code += `\ntry {\n  const response = await fetch(url);\n  const data = await response.json();\n  console.log(data);\n} catch (error) {\n  console.error('Fetch error:', error);\n}`;
      }
      return code;
    }

    case 'javascript-axios': {
      let code = `import axios from 'axios';\n\n`;
      const config = [];
      config.push(`  method: '${method.toLowerCase()}'`);
      config.push(`  url: '${url}'`);
      if (headerEntries.length > 0) {
        const hObj = headerEntries.map(([k, v]) => `    '${k}': '${v}'`).join(',\n');
        config.push(`  headers: {\n${hObj}\n  }`);
      }
      if (body) {
        if (isJson) {
          config.push(`  data: ${body}`);
        } else {
          config.push(`  data: '${body.replace(/'/g, "\\'")}'`);
        }
      }
      code += `try {\n  const response = await axios({\n${config.join(',\n')}\n  });\n  console.log(response.data);\n} catch (error) {\n  console.error('Axios error:', error);\n}`;
      return code;
    }

    case 'python-requests': {
      let code = `import requests\n\nurl = "${url}"\n`;
      if (headerEntries.length > 0) {
        const hObj = headerEntries.map(([k, v]) => `    "${k}": "${v}"`).join(',\n');
        code += `headers = {\n${hObj}\n}\n`;
      }
      if (body) {
        if (isJson) {
          code += `payload = ${JSON.stringify(JSON.parse(body), null, 4)}\n`;
        } else {
          code += `data = """${body}"""\n`;
        }
      }

      code += `\nresponse = requests.${method.toLowerCase()}(\n    url,`;
      if (headerEntries.length > 0) code += `\n    headers=headers,`;
      if (body && isJson) code += `\n    json=payload,`;
      else if (body) code += `\n    data=data,`;
      code += `\n)\n\nprint(response.status_code)\nprint(response.json())`;
      return code;
    }

    case 'python-httpx': {
      let code = `import httpx\nimport asyncio\n\nasync def main():\n    url = "${url}"\n`;
      if (headerEntries.length > 0) {
        const hObj = headerEntries.map(([k, v]) => `        "${k}": "${v}"`).join(',\n');
        code += `    headers = {\n${hObj}\n    }\n`;
      }
      if (body && isJson) {
        code += `    payload = ${JSON.stringify(JSON.parse(body), null, 8).trim()}\n`;
      }

      code += `\n    async with httpx.AsyncClient() as client:\n        response = await client.${method.toLowerCase()}(\n            url,`;
      if (headerEntries.length > 0) code += `\n            headers=headers,`;
      if (body && isJson) code += `\n            json=payload,`;
      else if (body) code += `\n            content="""${body}""",`;
      code += `\n        )\n        print(response.json())\n\nasyncio.run(main())`;
      return code;
    }

    case 'go': {
      let code = `package main\n\nimport (\n\t"fmt"\n\t"io"\n\t"net/http"\n`;
      if (body) code += `\t"strings"\n`;
      code += `)\n\nfunc main() {\n\turl := "${url}"\n`;
      if (body) {
        code += `\tpayload := strings.NewReader(\`${body}\`)\n`;
        code += `\treq, err := http.NewRequest("${method}", url, payload)\n`;
      } else {
        code += `\treq, err := http.NewRequest("${method}", url, nil)\n`;
      }
      code += `\tif err != nil {\n\t\tpanic(err)\n\t}\n\n`;

      headerEntries.forEach(([k, v]) => {
        code += `\treq.Header.Add("${k}", "${v}")\n`;
      });

      code += `\n\tres, err := http.DefaultClient.Do(req)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer res.Body.Close()\n\n\tbody, _ := io.ReadAll(res.Body)\n\tfmt.Println(res.StatusCode)\n\tfmt.Println(string(body))\n}`;
      return code;
    }

    case 'rust': {
      let code = `use reqwest::Client;\nuse std::error::Error;\n\n#[tokio::main]\nasync fn main() -> Result<(), Box<dyn Error>> {\n    let client = Client::new();\n`;
      code += `    let res = client\n        .${method.toLowerCase()}("${url}")\n`;

      headerEntries.forEach(([k, v]) => {
        code += `        .header("${k}", "${v}")\n`;
      });

      if (body && isJson) {
        code += `        .body(r#"${body}"#)\n`;
      } else if (body) {
        code += `        .body("${body.replace(/"/g, '\\"')}")\n`;
      }

      code += `        .send()\n        .await?;\n\n    let status = res.status();\n    let text = res.text().await?;\n    println!("Status: {}", status);\n    println!("Body: {}", text);\n\n    Ok(())\n}`;
      return code;
    }

    case 'csharp': {
      let code = `using System;\nusing System.Net.Http;\nusing System.Text;\nusing System.Threading.Tasks;\n\nclass Program {\n    static async Task Main() {\n        var client = new HttpClient();\n        var request = new HttpRequestMessage(HttpMethod.${method.charAt(0) + method.slice(1).toLowerCase()}, "${url}");\n\n`;

      headerEntries.forEach(([k, v]) => {
        if (k.toLowerCase() !== 'content-type') {
          code += `        request.Headers.TryAddWithoutValidation("${k}", "${v}");\n`;
        }
      });

      if (body) {
        const ct = headers['Content-Type'] || headers['content-type'] || 'application/json';
        code += `\n        request.Content = new StringContent(@"${body.replace(/"/g, '""')}", Encoding.UTF8, "${ct}");\n`;
      }

      code += `\n        var response = await client.SendAsync(request);\n        var responseBody = await response.Content.ReadAsStringAsync();\n        Console.WriteLine(responseBody);\n    }\n}`;
      return code;
    }

    case 'php': {
      let code = `<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, array(\n  CURLOPT_URL => '${url}',\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_ENCODING => '',\n  CURLOPT_MAXREDIRS => 10,\n  CURLOPT_TIMEOUT => 30,\n  CURLOPT_FOLLOWLOCATION => true,\n  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n  CURLOPT_CUSTOMREQUEST => '${method}',\n`;

      if (body) {
        code += `  CURLOPT_POSTFIELDS => '${body.replace(/'/g, "\\'")}',\n`;
      }

      if (headerEntries.length > 0) {
        const hArr = headerEntries.map(([k, v]) => `    '${k}: ${v}'`).join(',\n');
        code += `  CURLOPT_HTTPHEADER => array(\n${hArr}\n  ),\n`;
      }

      code += `));\n\n$response = curl_exec($curl);\ncurl_close($curl);\necho $response;\n`;
      return code;
    }

    case 'java': {
      let code = `import java.net.URI;\nimport java.net.http.HttpClient;\nimport java.net.http.HttpRequest;\nimport java.net.http.HttpResponse;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        HttpClient client = HttpClient.newHttpClient();\n        HttpRequest.Builder builder = HttpRequest.newBuilder()\n            .uri(URI.create("${url}"))\n`;

      headerEntries.forEach(([k, v]) => {
        code += `            .header("${k}", "${v}")\n`;
      });

      if (body) {
        code += `            .method("${method}", HttpRequest.BodyPublishers.ofString("${body.replace(/"/g, '\\"')}"));\n`;
      } else if (method === 'GET') {
        code += `            .GET();\n`;
      } else {
        code += `            .method("${method}", HttpRequest.BodyPublishers.noBody());\n`;
      }

      code += `\n        HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());\n        System.out.println(response.body());\n    }\n}`;
      return code;
    }

    case 'swift': {
      let code = `import Foundation\n\nvar request = URLRequest(url: URL(string: "${url}")!, timeoutInterval: Double.infinity)\nrequest.httpMethod = "${method}"\n`;

      headerEntries.forEach(([k, v]) => {
        code += `request.addValue("${v}", forHTTPHeaderField: "${k}")\n`;
      });

      if (body) {
        code += `\nlet bodyData = """\n${body}\n""".data(using: .utf8)\nrequest.httpBody = bodyData\n`;
      }

      code += `\nlet task = URLSession.shared.dataTask(with: request) { data, response, error in\n    guard let data = data else {\n        print(String(describing: error))\n        return\n    }\n    print(String(data: data, encoding: .utf8)!)\n}\n\ntask.resume()`;
      return code;
    }

    default:
      return '// Unsupported language selected';
  }
}
