package cn.pixel.pingdou.module.fms.dal.mysql.config;

import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.fms.dal.dataobject.config.FmsCurrencyDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.Collection;
import java.util.List;

/**
 * FMS 币种 Mapper
 *
 * @author 芋道源码
 */
@Mapper
public interface FmsCurrencyMapper extends BaseMapperX<FmsCurrencyDO> {

    default FmsCurrencyDO selectByAccountSetIdAndCode(Long accountSetId, String code) {
        return selectOne(FmsCurrencyDO::getAccountSetId, accountSetId,
                FmsCurrencyDO::getCode, code);
    }

    default FmsCurrencyDO selectByIdAndAccountSetId(Long id, Long accountSetId) {
        return selectOne(FmsCurrencyDO::getId, id,
                FmsCurrencyDO::getAccountSetId, accountSetId);
    }

    default List<FmsCurrencyDO> selectListByAccountSetId(Long accountSetId) {
        return selectList(new LambdaQueryWrapperX<FmsCurrencyDO>()
                .eq(FmsCurrencyDO::getAccountSetId, accountSetId)
                .orderByDesc(FmsCurrencyDO::getStandard)
                .orderByAsc(FmsCurrencyDO::getId));
    }

    default List<FmsCurrencyDO> selectListByIdsAndAccountSetId(
            Collection<Long> ids, Long accountSetId) {
        return selectList(new LambdaQueryWrapperX<FmsCurrencyDO>()
                .in(FmsCurrencyDO::getId, ids)
                .eq(FmsCurrencyDO::getAccountSetId, accountSetId));
    }

}
