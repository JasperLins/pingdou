# server · 后端服务（ruoyi-vue-pro fork）

> 拼豆生态的统一后端，基于芋道 ruoyi-vue-pro（Spring Boot 3.5.15，Java 17+，groupId `cn.pixel.boot`，包根 `cn.pixel.pingDou`，版本 2026.07-SNAPSHOT）。所有端（px-creat-web、admin-vue3、uniapp）经 REST API 接入此处。

## 模块结构

- `pingDou-dependencies` — BOM 依赖版本管理，新增三方依赖先在此定版本。
- `pingDou-framework` — 框架层：`pingDou-common` + 各 spring-boot-starter（web、security、mybatis、redis、mq、job、excel、tenant、data-permission 等）。**业务开发不改框架层**。
- `pingDou-server` — 启动/打包模块。入口 `PingDouServerApplication`；配置 `pingDou-server/src/main/resources/application*.yaml`，本地端口 **48080**。
- `pingDou-module-*` — 业务模块。**根 pom 当前仅启用 system / infra / member / bpm / pay**；mall/crm/erp/iot/ai/mp/report/mes/wms/hrm/fms/im 目录存在但被注释，需要时在根 pom 解开注释启用。拼豆业务新模块建议命名 `pingDou-module-pindou`。

## 单模块标准包结构（以 pingDou-module-system 为例）

```text
cn.pixel.pingDou.module.system
  controller/admin/<域>/        管理后台接口 + vo/（ReqVO/RespVO/PageReqVO）
  controller/app/<域>/          用户端接口（px-creat-web 走这里）
  service/<域>/                 接口 + XxxServiceImpl
  dal/dataobject/<域>/          DO（数据库实体）
  dal/mysql/<域>/               Mapper，继承 BaseMapperX<XxxDO>
  dal/redis/                    RedisKeyConstants + 子包
  api/                          跨模块 RPC 接口
  enums/ErrorCodeConstants.java 模块错误码（按 1-002-xxx-xxx 分段）
  convert/ job/ mq/ framework/ util/
```

## 典型写法（照 DeptController / DeptServiceImpl 模式）

- Controller：`@Tag` + `@RestController` + `@RequestMapping("/system/dept")` + `@Validated`；方法 `@PostMapping("create")`（无前导斜杠）+ `@Operation`；权限 `@PreAuthorize("@ss.hasPermission('system:dept:create')")`；返回 `CommonResult<T>`（静态导入 `success`），分页返回 `CommonResult<PageResult<XxxRespVO>>`；注入用 `@Resource`。
- ServiceImpl：`@Service` + `@Validated`；VO↔DO 转换统一用 `BeanUtils.toBean()`（`framework.common.util.object`），MapStruct 仅限既有 convert/。
- Mapper 继承框架封装的 `BaseMapperX`；Lombok 按 `lombok.config`（chain accessors）。
- 错误码：在模块 `enums/ErrorCodeConstants.java` 按段新增，禁止魔法数字。

## 数据库与运维

- 建表/变更 SQL 放 `sql/mysql/`（核心 `ruoyi-vue-pro.sql`）；表名小写下划线，遵循芋道约定（逻辑删除 `deleted`、租户字段等）。
- `script/`：docker-compose、deploy.sh、jenkins 等。

## 规范要点

- 无 checkstyle/spotless，规范靠自律 + code review；对齐既有代码风格（中文注释、Swagger 注解齐全）。
- API 是 px-creat-web 的唯一接入方式，接口风格必须保持 `CommonResult` 包装与 `/admin-api`、`/app-api` 前缀约定。
- 需求以根目录《V4.0 总纲》为初步基线，开发中基于讨论演进，冲突时以最新讨论为准并回写文档。
