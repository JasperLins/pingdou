package cn.pixel.pingdou.module.hrm.framework.operatelog.core;

import cn.hutool.core.util.StrUtil;
import cn.pixel.pingdou.module.hrm.enums.salary.config.HrmSalarySocialSecurityMonthTypeEnum;
import com.mzt.logapi.service.IParseFunction;
import org.springframework.stereotype.Component;

/**
 * HRM 薪资对应社保月份类型的 {@link IParseFunction} 实现类
 *
 * @author 芋道源码
 */
@Component
public class HrmSalarySocialSecurityMonthTypeParseFunction implements IParseFunction {

    public static final String NAME = "getSalarySocialSecurityMonthTypeName";

    @Override
    public String functionName() {
        return NAME;
    }

    @Override
    public String apply(Object value) {
        if (StrUtil.isEmptyIfStr(value)) {
            return "";
        }
        HrmSalarySocialSecurityMonthTypeEnum monthType =
                HrmSalarySocialSecurityMonthTypeEnum.valueOf(Integer.valueOf(value.toString()));
        return monthType == null ? "" : monthType.getName();
    }

}
