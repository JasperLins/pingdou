package cn.pixel.pingdou.module.hrm.dal.mysql.employee.employment;

import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.hrm.dal.dataobject.employee.employment.HrmEmployeeSalaryCardDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.Collection;
import java.util.List;

@Mapper
public interface HrmEmployeeSalaryCardMapper extends BaseMapperX<HrmEmployeeSalaryCardDO> {

    default HrmEmployeeSalaryCardDO selectByEmployeeId(Long employeeId) {
        return selectLastOne(new LambdaQueryWrapperX<HrmEmployeeSalaryCardDO>()
                .eq(HrmEmployeeSalaryCardDO::getEmployeeId, employeeId)
                .orderByAsc(HrmEmployeeSalaryCardDO::getId));
    }

    default List<HrmEmployeeSalaryCardDO> selectListByEmployeeIds(Collection<Long> employeeIds) {
        return selectList(new LambdaQueryWrapperX<HrmEmployeeSalaryCardDO>()
                .in(HrmEmployeeSalaryCardDO::getEmployeeId, employeeIds)
                .orderByAsc(HrmEmployeeSalaryCardDO::getEmployeeId)
                .orderByDesc(HrmEmployeeSalaryCardDO::getId));
    }

}
