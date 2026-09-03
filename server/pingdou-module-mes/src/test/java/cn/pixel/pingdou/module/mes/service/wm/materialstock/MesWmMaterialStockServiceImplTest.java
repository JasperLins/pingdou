package cn.pixel.pingdou.module.mes.service.wm.materialstock;

import cn.pixel.pingdou.framework.common.pojo.PageResult;
import cn.pixel.pingdou.framework.test.core.ut.BaseDbUnitTest;
import cn.pixel.pingdou.module.mes.controller.admin.wm.materialstock.vo.MesWmMaterialStockPageReqVO;
import cn.pixel.pingdou.module.mes.dal.dataobject.wm.materialstock.MesWmMaterialStockDO;
import cn.pixel.pingdou.module.mes.dal.dataobject.wm.warehouse.MesWmWarehouseDO;
import cn.pixel.pingdou.module.mes.dal.mysql.wm.materialstock.MesWmMaterialStockMapper;
import cn.pixel.pingdou.module.mes.service.md.item.MesMdItemService;
import cn.pixel.pingdou.module.mes.service.md.item.MesMdItemTypeService;
import cn.pixel.pingdou.module.mes.service.wm.warehouse.MesWmWarehouseAreaService;
import cn.pixel.pingdou.module.mes.service.wm.warehouse.MesWmWarehouseService;
import jakarta.annotation.Resource;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.function.Consumer;

import static cn.pixel.pingdou.framework.test.core.util.RandomUtils.randomPojo;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

/**
 * {@link MesWmMaterialStockServiceImpl} 的单元测试
 *
 * @author 芋道源码
 */
@Import(MesWmMaterialStockServiceImpl.class)
public class MesWmMaterialStockServiceImplTest extends BaseDbUnitTest {

    @Resource
    private MesWmMaterialStockServiceImpl materialStockService;

    @Resource
    private MesWmMaterialStockMapper materialStockMapper;

    @MockitoBean
    private MesMdItemService itemService;
    @MockitoBean
    private MesMdItemTypeService itemTypeService;
    @MockitoBean
    private MesWmWarehouseAreaService areaService;
    @MockitoBean
    private MesWmWarehouseService warehouseService;

    @Test
    public void testGetMaterialStockPage_virtualFilterOnly() {
        // 准备数据：虚拟仓库存 + 普通仓库存
        Long virtualWarehouseId = 100L;
        Long normalWarehouseId = 200L;
        MesWmMaterialStockDO virtualStock = createMaterialStockPojo(o -> o.setWarehouseId(virtualWarehouseId));
        MesWmMaterialStockDO normalStock = createMaterialStockPojo(o -> o.setWarehouseId(normalWarehouseId));
        materialStockMapper.insert(virtualStock);
        materialStockMapper.insert(normalStock);
        mockVirtualWarehouse(virtualWarehouseId);

        // 调用：只看虚拟仓
        MesWmMaterialStockPageReqVO reqVO = new MesWmMaterialStockPageReqVO();
        reqVO.setVirtualFilter(MesWmMaterialStockPageReqVO.VIRTUAL_FILTER_ONLY);
        PageResult<MesWmMaterialStockDO> result = materialStockService.getMaterialStockPage(reqVO);

        // 断言：只返回虚拟仓库存，且 total 与列表一致
        assertEquals(1, result.getTotal());
        assertEquals(1, result.getList().size());
        assertEquals(virtualStock.getId(), result.getList().get(0).getId());
    }

    @Test
    public void testGetMaterialStockPage_virtualFilterExclude() {
        // 准备数据：虚拟仓库存 + 普通仓库存
        Long virtualWarehouseId = 100L;
        Long normalWarehouseId = 200L;
        MesWmMaterialStockDO virtualStock = createMaterialStockPojo(o -> o.setWarehouseId(virtualWarehouseId));
        MesWmMaterialStockDO normalStock = createMaterialStockPojo(o -> o.setWarehouseId(normalWarehouseId));
        materialStockMapper.insert(virtualStock);
        materialStockMapper.insert(normalStock);
        mockVirtualWarehouse(virtualWarehouseId);

        // 调用：排除虚拟仓
        MesWmMaterialStockPageReqVO reqVO = new MesWmMaterialStockPageReqVO();
        reqVO.setVirtualFilter(MesWmMaterialStockPageReqVO.VIRTUAL_FILTER_EXCLUDE);
        PageResult<MesWmMaterialStockDO> result = materialStockService.getMaterialStockPage(reqVO);

        // 断言：只返回普通仓库存，且 total 与列表一致
        assertEquals(1, result.getTotal());
        assertEquals(1, result.getList().size());
        assertEquals(normalStock.getId(), result.getList().get(0).getId());
    }

    private MesWmMaterialStockDO createMaterialStockPojo(Consumer<MesWmMaterialStockDO> consumer) {
        return randomPojo(MesWmMaterialStockDO.class, o -> {
            o.setQuantity(new BigDecimal("10.00"));
            o.setReceiptTime(LocalDateTime.of(2026, 1, 1, 0, 0));
            o.setFrozen(false);
            o.setDeleted(false);
            consumer.accept(o);
        });
    }

    private void mockVirtualWarehouse(Long virtualWarehouseId) {
        MesWmWarehouseDO virtualWarehouse = new MesWmWarehouseDO();
        virtualWarehouse.setId(virtualWarehouseId);
        when(warehouseService.getWarehouseByCode(MesWmWarehouseDO.WIP_VIRTUAL_WAREHOUSE))
                .thenReturn(virtualWarehouse);
    }

}
