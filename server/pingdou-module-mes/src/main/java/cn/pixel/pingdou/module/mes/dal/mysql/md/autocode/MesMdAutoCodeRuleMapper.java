package cn.pixel.pingdou.module.mes.dal.mysql.md.autocode;

import cn.pixel.pingdou.framework.common.pojo.PageResult;
import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.mes.controller.admin.md.autocode.vo.rule.MesMdAutoCodeRulePageReqVO;
import cn.pixel.pingdou.module.mes.dal.dataobject.md.autocode.MesMdAutoCodeRuleDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

/**
 * MES 编码规则 Mapper
 *
 * @author 芋道源码
 */
@Mapper
public interface MesMdAutoCodeRuleMapper extends BaseMapperX<MesMdAutoCodeRuleDO> {

    default PageResult<MesMdAutoCodeRuleDO> selectPage(MesMdAutoCodeRulePageReqVO reqVO) {
        return selectPage(reqVO, new LambdaQueryWrapperX<MesMdAutoCodeRuleDO>()
                .likeIfPresent(MesMdAutoCodeRuleDO::getCode, reqVO.getCode())
                .likeIfPresent(MesMdAutoCodeRuleDO::getName, reqVO.getName())
                .eqIfPresent(MesMdAutoCodeRuleDO::getStatus, reqVO.getStatus())
                .betweenIfPresent(MesMdAutoCodeRuleDO::getCreateTime, reqVO.getCreateTime())
                .orderByDesc(MesMdAutoCodeRuleDO::getId));
    }

    default MesMdAutoCodeRuleDO selectByCode(String code) {
        return selectOne(MesMdAutoCodeRuleDO::getCode, code);
    }

    default List<MesMdAutoCodeRuleDO> selectListByStatus(Integer status) {
        return selectList(MesMdAutoCodeRuleDO::getStatus, status);
    }

}
