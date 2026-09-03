package cn.pixel.pingdou.module.crm.dal.mysql.performance;

import cn.pixel.pingdou.framework.common.pojo.PageResult;
import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.crm.controller.admin.performance.vo.config.CrmPerformanceConfigPageReqVO;
import cn.pixel.pingdou.module.crm.dal.dataobject.performance.CrmPerformanceConfigDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.Collection;
import java.util.List;

/**
 * CRM 业绩目标配置 Mapper
 *
 * @author 芋道源码
 */
@Mapper
public interface CrmPerformanceConfigMapper extends BaseMapperX<CrmPerformanceConfigDO> {

    default PageResult<CrmPerformanceConfigDO> selectPage(CrmPerformanceConfigPageReqVO reqVO) {
        return selectPage(reqVO, new LambdaQueryWrapperX<CrmPerformanceConfigDO>()
                .eqIfPresent(CrmPerformanceConfigDO::getObjectId, reqVO.getObjectId())
                .eqIfPresent(CrmPerformanceConfigDO::getObjectType, reqVO.getObjectType())
                .eqIfPresent(CrmPerformanceConfigDO::getYear, reqVO.getYear())
                .eqIfPresent(CrmPerformanceConfigDO::getBizType, reqVO.getBizType())
                .orderByDesc(CrmPerformanceConfigDO::getYear)
                .orderByAsc(CrmPerformanceConfigDO::getObjectType)
                .orderByAsc(CrmPerformanceConfigDO::getObjectId)
                .orderByAsc(CrmPerformanceConfigDO::getBizType));
    }

    default CrmPerformanceConfigDO selectByObjectIdAndObjectTypeAndYearAndBizType(Long objectId, Integer objectType,
                                                                                   Integer year, Integer bizType) {
        return selectOne(new LambdaQueryWrapperX<CrmPerformanceConfigDO>()
                .eq(CrmPerformanceConfigDO::getObjectId, objectId)
                .eq(CrmPerformanceConfigDO::getObjectType, objectType)
                .eq(CrmPerformanceConfigDO::getYear, year)
                .eq(CrmPerformanceConfigDO::getBizType, bizType));
    }

    default List<CrmPerformanceConfigDO> selectListByObjectIdsAndObjectTypeAndYearAndBizType(Collection<Long> objectIds,
                                                                                             Integer objectType,
                                                                                             Integer year,
                                                                                             Integer bizType) {
        return selectList(new LambdaQueryWrapperX<CrmPerformanceConfigDO>()
                .in(CrmPerformanceConfigDO::getObjectId, objectIds)
                .eq(CrmPerformanceConfigDO::getObjectType, objectType)
                .eq(CrmPerformanceConfigDO::getYear, year)
                .eq(CrmPerformanceConfigDO::getBizType, bizType));
    }

}
