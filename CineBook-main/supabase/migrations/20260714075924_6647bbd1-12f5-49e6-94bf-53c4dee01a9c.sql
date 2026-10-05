UPDATE public.snacks SET image_url = CASE name
  WHEN 'Bottled Water' THEN 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80'
  WHEN 'Coca-Cola (Large)' THEN 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80'
  WHEN 'Coca-Cola (Regular)' THEN 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80'
  WHEN 'Sprite' THEN 'https://images.unsplash.com/photo-1690987328993-14200b0bda9d?w=400&q=80'
  WHEN 'Popcorn + Coke Combo' THEN 'https://images.unsplash.com/photo-1585647347384-2593bc35786b?w=400&q=80'
  WHEN 'Choco Lava Cake' THEN 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&q=80'
  WHEN 'Vanilla Ice Cream Cup' THEN 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&q=80'
  WHEN 'Caramel Popcorn' THEN 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&q=80'
  WHEN 'Cheese Popcorn' THEN 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400&q=80'
  WHEN 'Large Salted Popcorn' THEN 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=400&q=80'
  WHEN 'Regular Salted Popcorn' THEN 'https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?w=400&q=80'
  WHEN 'Nachos with Salsa' THEN 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400&q=80'
  WHEN 'Veg Samosa (2 pc)' THEN 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80'
END
WHERE name IN ('Bottled Water','Coca-Cola (Large)','Coca-Cola (Regular)','Sprite','Popcorn + Coke Combo','Choco Lava Cake','Vanilla Ice Cream Cup','Caramel Popcorn','Cheese Popcorn','Large Salted Popcorn','Regular Salted Popcorn','Nachos with Salsa','Veg Samosa (2 pc)');