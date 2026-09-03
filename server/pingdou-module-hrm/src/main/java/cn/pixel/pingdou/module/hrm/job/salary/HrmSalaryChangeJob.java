package cn.pixel.pingdou.module.hrm.job.salary;

import cn.hutool.core.util.StrUtil;
import cn.pixel.pingdou.framework.quartz.core.handler.JobHandler;
import cn.pixel.pingdou.framework.tenant.core.job.TenantJob;
import cn.pixel.pingdou.module.hrm.service.salary.employee.HrmSalaryEmployeeInfoService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;

/**
 * HRM 定薪调薪记录生效 Job
 *
 * @author 芋道源码
 */
@Component
public class HrmSalaryChangeJob implements JobHandler {

    @Resource
    private HrmSalaryEmployeeInfoService salaryEmployeeInfoService;

    @Override
    @TenantJob
    public String execute(String param) {
        LocalDate targetDate = StrUtil.isBlank(param) ? LocalDate.now() : LocalDate.parse(param);

        // 1. 应用到期的调薪记录
        List<Long> employeeIds = salaryEmployeeInfoService.applyDueSalaryChanges(targetDate);

        // 2. 返回执行结果
        return String.format("HRM 薪资调整生效：日期 %s，生效 %s 条，影响员工 %s 人",
                targetDate, employeeIds.size(), new HashSet<>(employeeIds).size());
    }

}
