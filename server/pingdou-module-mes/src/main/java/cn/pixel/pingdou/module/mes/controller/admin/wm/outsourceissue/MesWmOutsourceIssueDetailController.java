package cn.pixel.pingdou.module.mes.controller.admin.wm.outsourceissue;

import cn.hutool.core.collection.CollUtil;
import cn.pixel.pingdou.framework.common.pojo.CommonResult;
import cn.pixel.pingdou.framework.common.util.collection.MapUtils;
import cn.pixel.pingdou.framework.common.util.object.BeanUtils;
import cn.pixel.pingdou.module.mes.controller.admin.wm.outsourceissue.vo.detail.MesWmOutsourceIssueDetailRespVO;
import cn.pixel.pingdou.module.mes.controller.admin.wm.outsourceissue.vo.detail.MesWmOutsourceIssueDetailSaveReqVO;
import cn.pixel.pingdou.module.mes.dal.dataobject.md.item.MesMdItemDO;
import cn.pixel.pingdou.module.mes.dal.dataobject.md.unitmeasure.MesMdUnitMeasureDO;
import cn.pixel.pingdou.module.mes.dal.dataobject.wm.outsourceissue.MesWmOutsourceIssueDetailDO;
import cn.pixel.pingdou.module.mes.dal.dataobject.wm.warehouse.MesWmWarehouseAreaDO;
import cn.pixel.pingdou.module.mes.dal.dataobject.wm.warehouse.MesWmWarehouseDO;
import cn.pixel.pingdou.module.mes.dal.dataobject.wm.warehouse.MesWmWarehouseLocationDO;
import cn.pixel.pingdou.module.mes.service.md.item.MesMdItemService;
import cn.pixel.pingdou.module.mes.service.md.unitmeasure.MesMdUnitMeasureService;
import cn.pixel.pingdou.module.mes.service.wm.outsourceissue.MesWmOutsourceIssueDetailService;
import cn.pixel.pingdou.module.mes.service.wm.warehouse.MesWmWarehouseAreaService;
import cn.pixel.pingdou.module.mes.service.wm.warehouse.MesWmWarehouseLocationService;
import cn.pixel.pingdou.module.mes.service.wm.warehouse.MesWmWarehouseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static cn.pixel.pingdou.framework.common.pojo.CommonResult.success;
import static cn.pixel.pingdou.framework.common.util.collection.CollectionUtils.convertSet;

@Tag(name = "管理后台 - MES 外协发料单明细")
@RestController
@RequestMapping("/mes/wm/outsource-issue-detail")
@Validated
public class MesWmOutsourceIssueDetailController {

    @Resource
    private MesWmOutsourceIssueDetailService outsourceIssueDetailService;
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

    @PostMapping("/create")
    @Operation(summary = "创建外协发料单明细")
    @PreAuthorize("@ss.hasPermission('mes:wm-outsource-issue:create')")
    public CommonResult<Long> createOutsourceIssueDetail(@Valid @RequestBody MesWmOutsourceIssueDetailSaveReqVO createReqVO) {
        return success(outsourceIssueDetailService.createOutsourceIssueDetail(createReqVO));
    }

    @PutMapping("/update")
    @Operation(summary = "修改外协发料单明细")
    @PreAuthorize("@ss.hasPermission('mes:wm-outsource-issue:update')")
    public CommonResult<Boolean> updateOutsourceIssueDetail(@Valid @RequestBody MesWmOutsourceIssueDetailSaveReqVO updateReqVO) {
        outsourceIssueDetailService.updateOutsourceIssueDetail(updateReqVO);
        return success(true);
    }

    @DeleteMapping("/delete")
    @Operation(summary = "删除外协发料单明细")
    @Parameter(name = "id", description = "编号", required = true)
    @PreAuthorize("@ss.hasPermission('mes:wm-outsource-issue:delete')")
    public CommonResult<Boolean> deleteOutsourceIssueDetail(@RequestParam("id") Long id) {
        outsourceIssueDetailService.deleteOutsourceIssueDetail(id);
        return success(true);
    }

    @GetMapping("/get")
    @Operation(summary = "获得外协发料单明细")
    @Parameter(name = "id", description = "编号", required = true, example = "1024")
    @PreAuthorize("@ss.hasPermission('mes:wm-outsource-issue:query')")
    public CommonResult<MesWmOutsourceIssueDetailRespVO> getOutsourceIssueDetail(@RequestParam("id") Long id) {
        MesWmOutsourceIssueDetailDO detail = outsourceIssueDetailService.getOutsourceIssueDetail(id);
        if (detail == null) {
            return success(null);
        }
        return success(buildRespVOList(Collections.singletonList(detail)).get(0));
    }

    @GetMapping("/list-by-line")
    @Operation(summary = "获得外协发料单明细列表（按行ID）")
    @Parameter(name = "lineId", description = "行ID", required = true, example = "1024")
    @PreAuthorize("@ss.hasPermission('mes:wm-outsource-issue:query')")
    public CommonResult<List<MesWmOutsourceIssueDetailRespVO>> getOutsourceIssueDetailListByLineId(
            @RequestParam("lineId") Long lineId) {
        List<MesWmOutsourceIssueDetailDO> list = outsourceIssueDetailService.getOutsourceIssueDetailListByLineId(lineId);
        return success(buildRespVOList(list));
    }

    // ==================== 拼接 VO ====================

    private List<MesWmOutsourceIssueDetailRespVO> buildRespVOList(List<MesWmOutsourceIssueDetailDO> list) {
        if (CollUtil.isEmpty(list)) {
            return Collections.emptyList();
        }
        // 1. 获得关联数据
        Map<Long, MesMdItemDO> itemMap = itemService.getItemMap(
                convertSet(list, MesWmOutsourceIssueDetailDO::getItemId));
        Map<Long, MesMdUnitMeasureDO> unitMeasureMap = unitMeasureService.getUnitMeasureMap(
                convertSet(itemMap.values(), MesMdItemDO::getUnitMeasureId));
        Map<Long, MesWmWarehouseDO> warehouseMap = warehouseService.getWarehouseMap(
                convertSet(list, MesWmOutsourceIssueDetailDO::getWarehouseId));
        Map<Long, MesWmWarehouseLocationDO> locationMap = locationService.getWarehouseLocationMap(
                convertSet(list, MesWmOutsourceIssueDetailDO::getLocationId));
        Map<Long, MesWmWarehouseAreaDO> areaMap = areaService.getWarehouseAreaMap(
                convertSet(list, MesWmOutsourceIssueDetailDO::getAreaId));
        // 2. 构建结果
        return BeanUtils.toBean(list, MesWmOutsourceIssueDetailRespVO.class, vo -> {
            MapUtils.findAndThen(itemMap, vo.getItemId(), item -> {
                vo.setItemCode(item.getCode()).setItemName(item.getName()).setSpecification(item.getSpecification());
                MapUtils.findAndThen(unitMeasureMap, item.getUnitMeasureId(),
                        unitMeasure -> vo.setUnitMeasureName(unitMeasure.getName()));
            });
            MapUtils.findAndThen(warehouseMap, vo.getWarehouseId(),
                    warehouse -> vo.setWarehouseName(warehouse.getName()));
            MapUtils.findAndThen(locationMap, vo.getLocationId(),
                    location -> vo.setLocationName(location.getName()));
            MapUtils.findAndThen(areaMap, vo.getAreaId(),
                    area -> vo.setAreaName(area.getName()));
        });
    }

}
