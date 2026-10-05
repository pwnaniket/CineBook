UPDATE public.snacks SET image_url = CASE name
  WHEN 'Regular Salted Popcorn' THEN 'https://images.unsplash.com/photo-1578849278002-b58e2c92a2c7?w=600&q=80'
  WHEN 'Large Salted Popcorn' THEN 'https://images.unsplash.com/photo-1585647347384-2593bc35786b?w=600&q=80'
  WHEN 'Cheese Popcorn' THEN 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=600&q=80'
  WHEN 'Caramel Popcorn' THEN 'https://images.unsplash.com/photo-1614145121029-83a9f7b68bf4?w=600&q=80'
  WHEN 'Popcorn + Coke Combo' THEN 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=600&q=80'
  WHEN 'Choco Lava Cake' THEN 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600&q=80'
  WHEN 'Vanilla Ice Cream Cup' THEN 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600&q=80'
  WHEN 'Nachos with Salsa' THEN 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=600&q=80'
  WHEN 'Veg Samosa (2 pc)' THEN 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80'
  WHEN 'Coca-Cola (Large)' THEN 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=600&q=80'
  WHEN 'Coca-Cola (Regular)' THEN 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&q=80'
  WHEN 'Sprite' THEN 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=600&q=80'
  WHEN 'Bottled Water' THEN 'https://images.unsplash.com/photo-1560023907-5f339617ea30?w=600&q=80'
  ELSE image_url END
WHERE name IN ('Bottled Water','Coca-Cola (Large)','Coca-Cola (Regular)','Sprite','Popcorn + Coke Combo','Choco Lava Cake','Vanilla Ice Cream Cup','Caramel Popcorn','Cheese Popcorn','Large Salted Popcorn','Regular Salted Popcorn','Nachos with Salsa','Veg Samosa (2 pc)');