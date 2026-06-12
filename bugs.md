# 车号未显示
## 2018
 - vettel:5
 - raikkonen:7
 - grosjean:8
 - vandoorne:2
 - hartley:28
 - ericsson:9
 - sirokin:35

## 2019
 - vettel:5
 - raikkonen:7
 - grosjean:8
 - kvyat:26
 - giovinazzi:99
 - kubica:88

## 2020
 - vettel:5
 - raikkonen:7
 - grosjean:8
 - kvyat:26
 - giovinazzi:99
 - aitken:89
 - Fittipaldi:51

## 2021
 - vettel:5
 - raikkonen:7
 - giovinazzi:99
 - mazepin:9
 - kubica:88


# 车队颜色重构
## 2018
Mercedes： #00D2BE
Ferrari：  #DC0000、 #FFFFFF
Red Bull Racing：  #1E1A78、 #E10600
Force India / Racing Point Force India：  #F3A6C8、 #FFFFFF、 #E4007F
Williams：  #FFFFFF、
Renault：  #FFD200、 #050505
Toro Rosso：  #1F4FA3、 #C0C7D1
Haas： #FFFFFF、 #E10600、 #111111
McLaren： #FF8700、 #0057B8
Alfa Romeo Sauber： #FFFFFF、 #8A1538、 #0B1F3A

## 2019
Mercedes： #00D2BE
Ferrari： #DC0000、 #111111
Red Bull Racing： #1E1A78、 #E10600
McLaren： #FF8700、 #0057B8
Renault： #FFD200、 #050505
Toro Rosso： #1F4FA3、 #C0C7D1
Racing Point： #F3A6C8、 #0072CE、 #FFFFFF
Alfa Romeo Racing： #A00000、 #FFFFFF、 #111111
Haas： #C9A646、 #0A0A0A、 #FFFFFF
Williams： #FFFFFF、 #00A3E0、 #003DA5

## 2020
Mercedes： #050505、 #00D2BE、 #C0C0C0
Ferrari： #DC0000、 #FFFFFF
Red Bull Racing： #1E1A78、 #E10600
McLaren： #FF8700、 #0057B8、 #111111
Renault： #FFD200、 #050505、
AlphaTauri： #FFFFFF、 #1C2D4A、 #BFC7D5
Racing Point： #F3A6C8、 #0072CE、 #FFFFFF
Alfa Romeo Racing： #FFFFFF、 #9B111E、 #111111
Haas： #FFFFFF、 #E10600、 #111111
Williams： #005AFF、 #FFFFFF、 #001E60

## 2021
Mercedes： #050505、 #00D2BE、 #C0C0C0
Red Bull Racing： #1E1A78、 #E10600
Ferrari： #DC0000、  #111111
McLaren： #FF8700、 #0057B8、 #111111
Alpine： #005BA9、 #E10600、 #FFFFFF
AlphaTauri： #1C2D4A、 #FFFFFF、 #BFC7D5
Aston Martin： #006F62、 #F3A6C8、 #FFFFFF
Williams： #003DA5、 #00A3E0、 #FFFFFF、 #FFD200
Alfa Romeo Racing： #FFFFFF、 #9B111E、 #111111
Haas： #FFFFFF、 #0033A0、 #D52B1E

## 2022
Red Bull Racing： #1E1A78、 #E10600、
Ferrari： #DC0000、 #111111、 #FFD200
Mercedes： #00D2BE、 #C0C0C0、 #111111、
McLaren： #FF8700、 #0057B8、 #111111
Alpine： #005BA9、 #F3A6C8、 #111111
AlphaTauri： #1C2D4A、 #FFFFFF、 #BFC7D5
Aston Martin： #006F62、 #CEDC00、 #111111
Williams： #003DA5、 #00A3E0、 #111111、 #E10600
Alfa Romeo Racing： #9B111E、 #FFFFFF、 #111111
Haas： #F7F7F7、 #D0021B、 #0033A0

## 2023
Red Bull Racing： #1E1A78、 #E10600、
Mercedes： #050505、 #00D2BE、 #C0C0C0
Ferrari： #DC0000、 #111111、
McLaren： #FF8700、 #111111、 #0057B8
Aston Martin： #006F62、 #CEDC00、 #111111
Alpine： #005BA9、 #F3A6C8、 #111111
Williams： #003DA5、 #00A3E0、 #111111
AlphaTauri： #1C2D4A、 #FFFFFF、 #E10600
Alfa Romeo Racing： #111111、 #9B111E、 #FFFFFF
Haas： #0B0B0B、 #F5F5F5、 #E10600

## 2024
Red Bull Racing： #1E1A78、 #E10600
Mercedes： #050505、 #C0C0C0、 #00D2BE
Ferrari： #DC0000、 #FFFFFF、 #FFD200、 #111111
McLaren： #FF8700、 #111111、 #0057B8
Aston Martin： #006F62、 #CEDC00、 #111111
Alpine： #111111、 #F3A6C8、 #005BA9
Williams： #003DA5、 #00A3E0、 #111111
RB： #1434CB、 #FFFFFF、 #E10600、 #C0C7D1
Kick Sauber： #00FF5F、 #111111、 #FFFFFF
Haas： #111111、 #FFFFFF、 #E10600

## 2025
McLaren： #FF8700、 #111111、 #0057B8
Ferrari： #B80000、 #FFFFFF、 #0072CE、 #111111
Red Bull Racing： #1E1A78、 #E10600、 #FCD700
Mercedes： #050505、 #C0C0C0、 #00D2BE
Aston Martin： #006F62、 #CEDC00、 #C0C0C0
Alpine： #005BA9、 #F3A6C8、 #111111
Haas： #FFFFFF、 #111111、 #E10600
Racing Bulls： #FFFFFF、 #1434CB、 #E10600
Williams： #003DA5、 #00A3E0、 #FFFFFF、 #111111
Kick Sauber： #00FF5F、 #111111、 #FFFFFF



# 车队名称错误
## 2018-2021
 - Sauber->Alfa Romeo Sauber



# 在转会市场-全部车队中，出现一个车队实体的多个名称同时存在的bug
## 2018
 - Renault&Alpine： 应该只有Renault
 - Racing Point和Force India： 应该只有Force India。2018从比利时大奖赛开始可能存在按racing point或者racing point force india记录的成绩，也一律算给force india。

## 2019:
 - Renault&Alpine： 应该只有Renault
 - Racing Point和Aston Martin： 应该只有Racing Point

## 2020： 
 - Renault&Alpine： 应该只有Renault
 - Racing Point和Aston Martin： 应该只有Racing Point