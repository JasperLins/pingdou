package cn.pixel.pingdou.module.wms.dal.mysql.md.merchant;

import cn.pixel.pingdou.framework.common.pojo.PageResult;
import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.wms.controller.admin.md.merchant.vo.WmsMerchantListReqVO;
import cn.pixel.pingdou.module.wms.controller.admin.md.merchant.vo.WmsMerchantPageReqVO;
import cn.pixel.pingdou.module.wms.dal.dataobject.md.merchant.WmsMerchantDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

/**
 * WMS 往来企业 Mapper
 *
 * @author 芋道源码
 */
@Mapper
public interface WmsMerchantMapper extends BaseMapperX<WmsMerchantDO> {

    default PageResult<WmsMerchantDO> selectPage(WmsMerchantPageReqVO reqVO) {
        return selectPage(reqVO, new LambdaQueryWrapperX<WmsMerchantDO>()
                .eqIfPresent(WmsMerchantDO::getCode, reqVO.getCode())
                .likeIfPresent(WmsMerchantDO::getName, reqVO.getName())
                .eqIfPresent(WmsMerchantDO::getType, reqVO.getType())
                .inIfPresent(WmsMerchantDO::getType, reqVO.getTypes())
                .orderByDesc(WmsMerchantDO::getId));
    }

    default List<WmsMerchantDO> selectList(WmsMerchantListReqVO reqVO) {
        return selectList(new LambdaQueryWrapperX<WmsMerchantDO>()
                .eqIfPresent(WmsMerchantDO::getCode, reqVO.getCode())
                .likeIfPresent(WmsMerchantDO::getName, reqVO.getName())
                .eqIfPresent(WmsMerchantDO::getType, reqVO.getType())
                .inIfPresent(WmsMerchantDO::getType, reqVO.getTypes())
                .orderByDesc(WmsMerchantDO::getId));
    }

    default WmsMerchantDO selectByCode(String code) {
        return selectOne(WmsMerchantDO::getCode, code);
    }

    default WmsMerchantDO selectByName(String name) {
        return selectOne(WmsMerchantDO::getName, name);
    }

}
