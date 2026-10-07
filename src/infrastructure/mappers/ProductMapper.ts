import { Money } from '../../domain/model/Money';
import { Product } from '../../domain/model/Product';
import { ApiProductDto } from '../http/dto/api.dto';

export class ProductMapper {
  static toDomain(dto: ApiProductDto): Product {
    return {
      id: dto.id,
      name: dto.name,
      price: new Money(dto.price, dto.currency),
      stock: dto.stock,
      categoryId: dto.categoryId,
      categoryName: dto.categoryName,
      imageUrl: dto.imageUrl,
    };
  }
}