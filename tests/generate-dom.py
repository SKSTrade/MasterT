"""Build a DOM fixture for code integration tests (not a browser/layout test)."""
from html.parser import HTMLParser
from pathlib import Path
import json
class Parser(HTMLParser):
    def __init__(self):
        super().__init__(); self.stack=[]; self.nodes=[]
    def handle_starttag(self, tag, attrs):
        node={'tag':tag,'attrs':dict(attrs),'parent':self.stack[-1] if self.stack else None,'text':''}
        index=len(self.nodes); self.nodes.append(node)
        if tag not in ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']:
            self.stack.append(index)
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,-1,-1):
            if self.nodes[self.stack[i]]['tag']==tag:
                self.stack=self.stack[:i];break
    def handle_data(self,text):
        for i in self.stack:self.nodes[i]['text']+=text
p=Path(__file__).resolve().parent
parser=Parser();parser.feed((p.parent/'index.html').read_text())
(p/'dom-fixture.json').write_text(json.dumps(parser.nodes,ensure_ascii=False))
