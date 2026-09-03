package cn.pixel.pingdou.module.hrm.controller.admin.portal.employee;

import cn.pixel.pingdou.framework.common.pojo.CommonResult;
import cn.pixel.pingdou.framework.common.util.object.BeanUtils;
import cn.pixel.pingdou.module.hrm.controller.admin.employee.vo.certificate.HrmEmployeeCertificateRespVO;
import cn.pixel.pingdou.module.hrm.dal.dataobject.employee.experience.HrmEmployeeCertificateDO;
import cn.pixel.pingdou.module.hrm.service.employee.experience.HrmEmployeeCertificateService;
import cn.pixel.pingdou.module.hrm.service.employee.info.HrmEmployeeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.Resource;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import static cn.pixel.pingdou.framework.common.pojo.CommonResult.success;
import static cn.pixel.pingdou.framework.security.core.util.SecurityFrameworkUtils.getLoginUserId;

@Tag(name = "管理后台 - HRM 员工端证书")
@RestController
@RequestMapping("/hrm/portal/employee/certificate")
@Validated
public class HrmPortalEmployeeCertificateController {

    @Resource
    private HrmEmployeeCertificateService certificateService;
    @Resource
    private HrmEmployeeService employeeService;

    @GetMapping("/list")
    @Operation(summary = "获得我的证书列表")
    @PreAuthorize("@ss.hasPermission('hrm:portal:query')")
    public CommonResult<List<HrmEmployeeCertificateRespVO>> getCertificateList() {
        Long employeeId = employeeService.validateEmployeeBySelf(getLoginUserId()).getId();
        List<HrmEmployeeCertificateDO> certificates =
                certificateService.getCertificateListByEmployeeId(employeeId);
        return success(BeanUtils.toBean(certificates, HrmEmployeeCertificateRespVO.class));
    }

}
