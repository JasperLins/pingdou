package cn.pixel.pingdou.module.wms.dal.dataobject.md.item;

import cn.pixel.pingdou.framework.mybatis.core.dataobject.BaseDO;
import com.baomidou.mybatisplus.annotation.KeySequence;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.*;

/**
 * WMS 商品品牌 DO
 *
 * @author 芋道源码
 */
@TableName("wms_item_brand")
@KeySequence("wms_item_brand_seq")
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WmsItemBrandDO extends BaseDO {

    /**
     * 主键编号
     */
    @TableId
    private Long id;
    /**
     * 品牌编号
     */
    private String code;
    /**
     * 品牌名称
     */
    private String name;

}
