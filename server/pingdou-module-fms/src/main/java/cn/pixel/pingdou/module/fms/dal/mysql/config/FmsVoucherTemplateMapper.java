package cn.pixel.pingdou.module.fms.dal.mysql.config;

import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.fms.dal.dataobject.config.FmsVoucherTemplateDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

/**
 * FMS 凭证模板 Mapper
 *
 * @author 芋道源码
 */
@Mapper
public interface FmsVoucherTemplateMapper extends BaseMapperX<FmsVoucherTemplateDO> {

    default List<FmsVoucherTemplateDO> selectListByAccountSetId(Long accountSetId) {
        return selectList(new LambdaQueryWrapperX<FmsVoucherTemplateDO>()
                .eq(FmsVoucherTemplateDO::getAccountSetId, accountSetId)
                .orderByAsc(FmsVoucherTemplateDO::getCategoryId)
                .orderByAsc(FmsVoucherTemplateDO::getId));
    }

    default Long selectCountByCategoryId(Long categoryId) {
        return selectCount(FmsVoucherTemplateDO::getCategoryId, categoryId);
    }

}
