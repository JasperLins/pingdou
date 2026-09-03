package cn.pixel.pingdou.module.hrm.dal.mysql.insurance.employee;

import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.hrm.dal.dataobject.insurance.employee.HrmInsuranceEmployeeInfoDO;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.Collection;
import java.util.List;

@Mapper
public interface HrmInsuranceEmployeeInfoMapper extends BaseMapperX<HrmInsuranceEmployeeInfoDO> {

    default HrmInsuranceEmployeeInfoDO selectByEmployeeId(Long employeeId) {
        return selectLastOne(new LambdaQueryWrapperX<HrmInsuranceEmployeeInfoDO>()
                .eq(HrmInsuranceEmployeeInfoDO::getEmployeeId, employeeId)
                .orderByAsc(HrmInsuranceEmployeeInfoDO::getId));
    }

    default List<HrmInsuranceEmployeeInfoDO> selectListByEmployeeIds(Collection<Long> employeeIds) {
        return selectList(new LambdaQueryWrapperX<HrmInsuranceEmployeeInfoDO>()
                .in(HrmInsuranceEmployeeInfoDO::getEmployeeId, employeeIds)
                .orderByDesc(HrmInsuranceEmployeeInfoDO::getId));
    }

    default List<HrmInsuranceEmployeeInfoDO> selectListByIdDesc() {
        return selectList(new LambdaQueryWrapperX<HrmInsuranceEmployeeInfoDO>()
                .orderByDesc(HrmInsuranceEmployeeInfoDO::getId));
    }

    @SuppressWarnings("UnusedReturnValue")
    default int updateBySchemeId(Long schemeId, HrmInsuranceEmployeeInfoDO updateObj) {
        return update(updateObj, new LambdaUpdateWrapper<HrmInsuranceEmployeeInfoDO>()
                .eq(HrmInsuranceEmployeeInfoDO::getSchemeId, schemeId));
    }

}
