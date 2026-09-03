package cn.pixel.pingdou.module.hrm.dal.mysql.performance.assessment;

import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.hrm.dal.dataobject.performance.assessment.HrmPerformanceAssessmentActionRecordDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.Collection;
import java.util.List;

@Mapper
public interface HrmPerformanceAssessmentActionRecordMapper
        extends BaseMapperX<HrmPerformanceAssessmentActionRecordDO> {

    default List<HrmPerformanceAssessmentActionRecordDO> selectListByAssessmentId(Long assessmentId) {
        return selectList(new LambdaQueryWrapperX<HrmPerformanceAssessmentActionRecordDO>()
                .eq(HrmPerformanceAssessmentActionRecordDO::getAssessmentId, assessmentId)
                .orderByAsc(HrmPerformanceAssessmentActionRecordDO::getCreateTime)
                .orderByAsc(HrmPerformanceAssessmentActionRecordDO::getId));
    }

    default void deleteByAssessmentIds(Collection<Long> assessmentIds) {
        delete(new LambdaQueryWrapperX<HrmPerformanceAssessmentActionRecordDO>()
                .in(HrmPerformanceAssessmentActionRecordDO::getAssessmentId, assessmentIds));
    }

}
