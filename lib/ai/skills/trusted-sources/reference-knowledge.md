# 本地 Knowledge — 使用细节（3.1 用）

**路径**：工作区根目录下 `Knowledge/`。目录与文件会持续更新，以下为**发现方法**，不假定固定子目录名。

## 发现流程

1. **列文件**：`Glob` 使用 `Knowledge/**/*` 或按扩展名如 `Knowledge/**/*.md`；结果常按修改时间排序，可结合路径/文件名推断相关性（国家、行业、主题等）。
2. **按内容搜**：`Grep` 在 `Knowledge/` 下搜关键词（区域如 Vietnam、业务如 site selection、tax incentive、HR compliance 等），`output_mode: "files_with_matches"` 先得候选文件。
3. **组合**：可先 Glob 筛一批再 Grep 精筛，或先 Grep 再按路径/文件名取舍。
4. **锁定章节**：对候选文件 `Read`，先看标题/目录，再用 offset+limit 精读相关小节；必要时在章节内再搜关键词定位段落。

## 引用约定

- 必须标明：**文档路径**（如 `Knowledge/区域/越南/xxx.md`）+ **章节**（节名或「第 X 节」）。
- 示例：「以上判断参考《文档名》（Knowledge/…/xxx.md）中「Tax incentives」一节」。
