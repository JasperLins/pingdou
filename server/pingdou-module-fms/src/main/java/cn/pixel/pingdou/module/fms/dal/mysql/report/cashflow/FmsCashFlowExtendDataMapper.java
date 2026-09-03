package cn.pixel.pingdou.module.fms.dal.mysql.report.cashflow;

import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.fms.dal.dataobject.report.cashflow.FmsCashFlowExtendDataDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.Collection;
import java.util.List;

/**
 * FMS 现金流量表扩展数据 Mapper
 *
 * @author 芋道源码
 */
@Mapper
public interface FmsCashFlowExtendDataMapper extends BaseMapperX<FmsCashFlowExtendDataDO> {

    default List<FmsCashFlowExtendDataDO> selectListByPeriod(Long accountSetId, Integer fromPeriod,
                                                             Integer toPeriod, Integer type, Integer category) {
        return selectList(new LambdaQueryWrapperX<FmsCashFlowExtendDataDO>()
                .eq(FmsCashFlowExtendDataDO::getAccountSetId, accountSetId)
                .eq(FmsCashFlowExtendDataDO::getFromPeriod, fromPeriod)
                .eq(FmsCashFlowExtendDataDO::getToPeriod, toPeriod)
                .eq(FmsCashFlowExtendDataDO::getType, type)
                .eqIfPresent(FmsCashFlowExtendDataDO::getCategory, category)
                .orderByAsc(FmsCashFlowExtendDataDO::getSort)
                .orderByAsc(FmsCashFlowExtendDataDO::getId));
    }

    default List<FmsCashFlowExtendDataDO> selectListByIdsAndAccountSetId(Collection<Long> ids, Long accountSetId) {
        return selectList(new LambdaQueryWrapperX<FmsCashFlowExtendDataDO>()
                .in(FmsCashFlowExtendDataDO::getId, ids)
                .eq(FmsCashFlowExtendDataDO::getAccountSetId, accountSetId));
    }

}
