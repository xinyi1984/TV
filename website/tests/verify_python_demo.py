"""Run the documented Python spider through the app's actual JSON bridge functions."""
import ast
from abc import ABCMeta, abstractmethod
import json
import re
import sys
import types
from pathlib import Path

website = Path(__file__).resolve().parents[1]
app_bridge = website.parent / "chaquo/src/main/python/app.py"
source = (website / "app/spider/page.tsx").read_text(encoding="utf-8")
demo = re.search(r"const python = `([\s\S]*?)`;", source).group(1)
base = types.ModuleType("base.spider")
base_source = website.parent / "chaquo/src/main/python/base/spider.py"
base_tree = ast.parse(base_source.read_text(encoding="utf-8"))
base_class = next(node for node in base_tree.body if isinstance(node, ast.ClassDef) and node.name == "Spider")
base.__dict__.update(ABCMeta=ABCMeta, abstractmethod=abstractmethod)
exec(compile(ast.Module(body=[base_class], type_ignores=[]), str(base_source), "exec"), base.__dict__)
sys.modules["base"] = types.ModuleType("base")
sys.modules["base.spider"] = base
namespace = {}
exec(compile(demo, "documented_demo.py", "exec"), namespace)
spider = namespace["Spider"]()
names = {"str2json", "init", "getDependence", "homeContent", "homeVideoContent", "categoryContent", "detailContent", "searchContent", "playerContent", "action", "destroy"}
tree = ast.parse(app_bridge.read_text(encoding="utf-8"))
functions = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]
assert len(functions) == len(names)
bridge = {"json": json}
exec(compile(ast.Module(body=functions, type_ignores=[]), str(app_bridge), "exec"), bridge)
bridge["init"](spider, '{"region":"tw"}')
assert spider.extend == '{"region":"tw"}'
assert bridge["getDependence"](spider) == []


def read_result(name, *args):
    result = json.loads(bridge[name](spider, *args))
    assert isinstance(result, dict), (name, type(result).__name__)
    return result


def verify_data_flow():
    home = read_result("homeContent", True)
    category = read_result("categoryContent", home["class"][0]["type_id"], "1", True, "{}")
    assert type(category["pagecount"]) is int
    assert category["pagecount"] == 1
    item_id = category["list"][0]["vod_id"]
    detail = read_result("detailContent", json.dumps([item_id]))
    item = detail["list"][0]
    assert item["vod_id"] == item_id
    flag = item["vod_play_from"].split("$$$")[0].strip()
    episode = item["vod_play_url"].split("$$$")[0].split("#")[0]
    episode_name, episode_id = episode.split("$", 1)
    assert flag and episode_name and episode_id
    play = read_result("playerContent", flag, episode_id, "[]")
    assert type(play["parse"]) is int
    assert play["parse"] == 0
    assert play["url"] == "https://example.com/episode/1"


verify_data_flow()
print("home -> category -> detail -> player: bridge data flow OK")

for name, args in [
    ("homeVideoContent", [spider]),
    ("searchContent", [spider, "demo", False]),
    ("searchContent", [spider, "demo", False, "2"]),
    ("action", [spider, "demo"]),
]:
    assert json.loads(bridge[name](*args)) is None
    print(f"{name}: inherited default OK")
bridge["destroy"](spider)
print("init, dependence and destroy: real BaseSpider contract OK")
