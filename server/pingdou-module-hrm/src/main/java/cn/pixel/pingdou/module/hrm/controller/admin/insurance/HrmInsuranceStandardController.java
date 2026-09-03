package cn.pixel.pingdou.module.hrm.controller.admin.insurance;

import cn.pixel.pingdou.framework.common.pojo.CommonResult;
import cn.pixel.pingdou.module.hrm.controller.admin.insurance.vo.standard.HrmInsuranceStandardProjectListReqVO;
import cn.pixel.pingdou.module.hrm.controller.admin.insurance.vo.standard.HrmInsuranceStandardProjectRespVO;
import cn.pixel.pingdou.module.hrm.controller.admin.insurance.vo.standard.HrmInsuranceStandardTypeListReqVO;
import cn.pixel.pingdou.module.hrm.controller.admin.insurance.vo.standard.HrmInsuranceStandardTypeRespVO;
import cn.pixel.pingdou.module.hrm.service.insurance.config.HrmInsuranceStandardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import static cn.pixel.pingdou.framework.common.pojo.CommonResult.success;

@Tag(name = "管理后台 - HRM 标准参保数据")
@RestController
@RequestMapping("/hrm/insurance/standard")
@Validated
public class HrmInsuranceStandardController {

    @Resource
    private HrmInsuranceStandardService insuranceStandardService;

    @GetMapping("/type-list")
    @Operation(summary = "获得标准参保类型列表")
    @PreAuthorize("@ss.hasPermission('hrm:insurance:scheme:query')")
    public CommonResult<List<HrmInsuranceStandardTypeRespVO>> getStandardTypeList(
            @Valid HrmInsuranceStandardTypeListReqVO reqVO) {
        return success(insuranceStandardService.getStandardTypeList(reqVO.getAreaId()));
    }

    @GetMapping("/project-list")
    @Operation(summary = "获得标准参保项目列表")
    @PreAuthorize("@ss.hasPermission('hrm:insurance:scheme:query')")
    public CommonResult<List<HrmInsuranceStandardProjectRespVO>> getStandardProjectList(
            @Valid HrmInsuranceStandardProjectListReqVO reqVO) {
        return success(insuranceStandardService.getStandardProjectList(reqVO.getAreaId(), reqVO.getTypeCode()));
    }

}
