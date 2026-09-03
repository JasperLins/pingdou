package cn.pixel.pingdou.module.mes.controller.admin.wm.materialstock;

import cn.hutool.core.collection.CollUtil;
import cn.pixel.pingdou.framework.apilog.core.annotation.ApiAccessLog;
import cn.pixel.pingdou.framework.common.pojo.CommonResult;
import cn.pixel.pingdou.framework.common.pojo.PageParam;
import cn.pixel.pingdou.framework.common.pojo.PageResult;
import cn.pixel.pingdou.framework.common.util.collection.MapUtils;
import cn.pixel.pingdou.framework.common.util.object.BeanUtils;
import cn.pixel.pingdou.framework.excel.core.util.ExcelUtils;
import cn.pixel.pingdou.module.mes.controller.admin.wm.materialstock.vo.MesWmMaterialStockPageReqVO;
import cn.pixel.pingdou.module.mes.controller.admin.wm.materialstock.vo.MesWmMaterialStockRespVO;
import cn.pixel.pingdou.module.mes.controller.admin.wm.materialstock.vo.MesWmMaterialStockFreezeReqVO;
import cn.pixel.pingdou.module.mes.dal.dataobject.md.item.MesMdItemDO;
import cn.pixel.pingdou.module.mes.dal.dataobject.md.unitmeasure.MesMdUnitMeasureDO;
import cn.pixel.pingdou.module.mes.dal.dataobject.md.vendor.MesMdVendorDO;
import cn.pixel.pingdou.module.mes.dal.dataobject.wm.materialstock.MesWmMaterialStockDO;
import cn.pixel.pingdou.module.mes.dal.dataobject.wm.warehouse.MesWmWarehouseAreaDO;
import cn.pixel.pingdou.module.mes.dal.dataobject.wm.warehouse.MesWmWarehouseDO;
import cn.pixel.pingdou.module.mes.dal.dataobject.wm.warehouse.MesWmWarehouseLocationDO;
import cn.pixel.pingdou.module.mes.service.md.item.MesMdItemService;
import cn.pixel.pingdou.module.mes.service.md.unitmeasure.MesMdUnitMeasureService;
import cn.pixel.pingdou.module.mes.service.md.vendor.MesMdVendorService;
import cn.pixel.pingdou.module.mes.service.wm.materialstock.MesWmMaterialStockService;
import cn.pixel.pingdou.module.mes.service.wm.warehouse.MesWmWarehouseAreaService;
import cn.pixel.pingdou.module.mes.service.wm.warehouse.MesWmWarehouseLocationService;
import cn.pixel.pingdou.module.mes.service.wm.warehouse.MesWmWarehouseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static cn.pixel.pingdou.framework.apilog.core.enums.OperateTypeEnum.EXPORT;
import static cn.pixel.pingdou.framework.common.pojo.CommonResult.success;
import static cn.pixel.pingdou.framework.common.util.collection.CollectionUtils.convertSet;

@Tag(name = "管理后台 - MES 库存台账")
@RestController
@RequestMapping("/mes/wm/material-stock")
@Validated
public class MesWmMaterialStockController {

    @Resource
    private MesWmMaterialStockService materialStockService;
    @Resource
    private MesMdItemService itemService;
    @Resource
    private MesMdUnitMeasureService unitMeasureService;
    @Resource
    private MesWmWarehouseService warehouseService;
    @Resource
    private MesWmWarehouseLocationService locationService;
    @Resource
    private MesWmWarehouseAreaService areaService;
    @Resource
    private MesMdVendorService vendorService;

    @GetMapping("/get")
    @Operation(summary = "获得库存记录")
    @Parameter(name = "id", description = "编号", required = true, example = "1024")
    @PreAuthorize("@ss.hasPermission('mes:wm-material-stock:query')")
    public CommonResult<MesWmMaterialStockRespVO> getMaterialStock(@RequestParam("id") Long id) {
        MesWmMaterialStockDO stock = materialStockService.getMaterialStock(id);
        if (stock == null) {
            return success(null);
        }
        return success(buildRespVOList(Collections.singletonList(stock)).get(0));
    }

    @GetMapping("/page")
    @Operation(summary = "获得库存台账分页")
    @PreAuthorize("@ss.hasPermission('mes:wm-material-stock:query')")
    public CommonResult<PageResult<MesWmMaterialStockRespVO>> getMaterialStockPage(
            @Valid MesWmMaterialStockPageReqVO pageReqVO) {
        PageResult<MesWmMaterialStockDO> pageResult = materialStockService.getMaterialStockPage(pageReqVO);
        return success(new PageResult<>(buildRespVOList(pageResult.getList()), pageResult.getTotal()));
    }

    @PutMapping("/update-frozen")
    @Operation(summary = "更新库存冻结状态")
    @PreAuthorize("@ss.hasPermission('mes:wm-material-stock:update')")
    public CommonResult<Boolean> updateMaterialStockFrozen(
            @Valid @RequestBody MesWmMaterialStockFreezeReqVO updateReqVO) {
        materialStockService.updateMaterialStockFrozen(updateReqVO);
        return success(true);
    }

    @GetMapping("/export-excel")
    @Operation(summary = "导出库存台账 Excel")
    @PreAuthorize("@ss.hasPermission('mes:wm-material-stock:export')")
    @ApiAccessLog(operateType = EXPORT)
    public void exportMaterialStockExcel(@Valid MesWmMaterialStockPageReqVO pageReqVO,
                                          HttpServletResponse response) throws IOException {
        pageReqVO.setPageSize(PageParam.PAGE_SIZE_NONE);
        PageResult<MesWmMaterialStockDO> pageResult = materialStockService.getMaterialStockPage(pageReqVO);
        ExcelUtils.write(response, "库存台账.xls", "数据", MesWmMaterialStockRespVO.class,
                buildRespVOList(pageResult.getList()));
    }

    // ==================== 拼接 VO ====================

    private List<MesWmMaterialStockRespVO> buildRespVOList(List<MesWmMaterialStockDO> list) {
        if (CollUtil.isEmpty(list)) {
            return Collections.emptyList();
        }
        // 1. 获得关联数据
        Map<Long, MesMdItemDO> itemMap = itemService.getItemMap(
                convertSet(list, MesWmMaterialStockDO::getItemId));
        Map<Long, MesMdUnitMeasureDO> unitMeasureMap = unitMeasureService.getUnitMeasureMap(
                convertSet(itemMap.values(), MesMdItemDO::getUnitMeasureId));
        Map<Long, MesWmWarehouseDO> warehouseMap = warehouseService.getWarehouseMap(
                convertSet(list, MesWmMaterialStockDO::getWarehouseId));
        Map<Long, MesWmWarehouseLocationDO> locationMap = locationService.getWarehouseLocationMap(
                convertSet(list, MesWmMaterialStockDO::getLocationId));
        Map<Long, MesWmWarehouseAreaDO> areaMap = areaService.getWarehouseAreaMap(
                convertSet(list, MesWmMaterialStockDO::getAreaId));
        Map<Long, MesMdVendorDO> vendorMap = vendorService.getVendorMap(
                convertSet(list, MesWmMaterialStockDO::getVendorId));
        // 2. 构建结果
        return BeanUtils.toBean(list, MesWmMaterialStockRespVO.class, vo -> {
            MapUtils.findAndThen(itemMap, vo.getItemId(), item -> {
                vo.setItemCode(item.getCode()).setItemName(item.getName()).setSpecification(item.getSpecification());
                MapUtils.findAndThen(unitMeasureMap, item.getUnitMeasureId(),
                        unitMeasure -> vo.setUnitMeasureName(unitMeasure.getName()));
            });
            MapUtils.findAndThen(warehouseMap, vo.getWarehouseId(), warehouse ->
                    vo.setWarehouseCode(warehouse.getCode()).setWarehouseName(warehouse.getName()));
            MapUtils.findAndThen(locationMap, vo.getLocationId(),
                    location -> vo.setLocationName(location.getName()));
            MapUtils.findAndThen(areaMap, vo.getAreaId(),
                    area -> vo.setAreaName(area.getName()));
            MapUtils.findAndThen(vendorMap, vo.getVendorId(),
                    vendor -> vo.setVendorName(vendor.getName()));
        });
    }

}
