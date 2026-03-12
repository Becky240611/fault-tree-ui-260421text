import xml.etree.ElementTree as ET
import json, re

tree = ET.parse(r'C:\Users\明芳\Downloads\維修流程.xml.xml')
root = tree.getroot()

result = {}
for diagram in root.findall('diagram'):
    diag_name = diagram.get('name')
    diagram_result = {}
    graph_model = diagram.find('mxGraphModel/root')
    if graph_model is None: 
        continue
    
    nodes = {}
    edges = []
    
    for cell in graph_model.findall('mxCell'):
        cell_id = cell.get('id')
        if cell.get('source') and cell.get('target'):
            edges.append((cell.get('source'), cell.get('target')))
        else:
            val = cell.get('value')
            if val is not None:
                # remove html tags and HTML entities
                clean_val = re.sub('<[^<]+>', ' ', val).replace('&nbsp;', ' ').strip()
                # Remove consecutive spaces
                clean_val = re.sub(r'\s+', ' ', clean_val).strip()
                nodes[cell_id] = clean_val
            else:
                nodes[cell_id] = ''
                
    adj = {k: [] for k in nodes}
    for u, v in edges:
        if u in adj:
            adj[u].append(v)
            
    # Resolve empty nodes (like OR gates)
    def get_real_children(u, visited=None):
        if visited is None: visited = set()
        res = []
        for nxt in adj.get(u, []):
            if nxt in visited: continue
            visited.add(nxt)
            if nxt in nodes and nodes[nxt]: # non-empty text
                res.append(nxt)
            else:
                res.extend(get_real_children(nxt, visited))
        seen = set()
        return [x for x in res if not (x in seen or seen.add(x))]

    real_adj = {}
    for u, val in nodes.items():
        if val:
            children = get_real_children(u)
            real_adj[u] = children
            opts = []
            for c in children:
                opts.append({
                    'label': nodes.get(c, 'Unknown'),
                    'nextId': f"{diag_name}_{c}"
                })
            diagram_result[u] = {
                'title': val,
                'desc': "請選擇相應的狀況進行排除或查看下一步",
                'options': opts
            }

    # Find roots
    in_degree = {k: 0 for k in real_adj.keys()}
    for u, children in real_adj.items():
        for c in children:
            if c in in_degree:
                in_degree[c] += 1
                
    roots = [k for k, v in in_degree.items() if v == 0]
    
    prefix_diagram_result = {f"{diag_name}_{k}": v for k, v in diagram_result.items()}
    
    result[diag_name] = {
        'nodes': prefix_diagram_result,
        'roots': [f"{diag_name}_{r}" for r in roots]
    }

with open(r'c:\Users\明芳\Desktop\練習\fault-tree-ui\parsed_tree.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print("Complete. Found diagrams:", list(result.keys()))
